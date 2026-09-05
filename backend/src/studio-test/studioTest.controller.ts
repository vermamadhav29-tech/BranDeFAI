/**
 * studioTest.controller.ts
 *
 * Fully self-contained handler for POST /api/studio-test/generate.
 * Imports NOTHING from the existing service pipeline.
 *
 * Pipeline (no AI image generation):
 *   BiRefNet cutout (foreground) + original photo blurred (backdrop)
 *   + GPT-4o creative analysis + Sharp text/logo overlays → 1080×1080 JPEG.
 */

import { randomUUID } from "crypto";
import type { Request, Response as ExpressResponse } from "express";
import { v2 as cloudinary } from "cloudinary";
import Redis from "ioredis";
import { buildPromoPost } from "./studioTestPromo";
import { removeBackground } from "./backgroundRemoval";
import {
  analyzeCreative,
  type CreativeAnalysis,
  type PostType,
  CREATIVE_FALLBACK,
} from "./productVision";
import {
  getIndustryConfig,
  type IndustryConfig,
  type PromptTemplateVariant,
} from "../services/promptTemplates/industryTemplates";

// ─── Logger ───────────────────────────────────────────────────────────────────

type Logger = (msg: string) => void;

// ─── Cloudinary — self-contained upload ───────────────────────────────────────

function cfgCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function uploadBuf(buf: Buffer, folder: string): Promise<string> {
  cfgCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => {
        if (err)     return reject(new Error(`Cloudinary error: ${err.message}`));
        if (!result) return reject(new Error("Cloudinary returned no result"));
        resolve(result.secure_url);
      },
    );
    stream.end(buf);
  });
}

// ─── Template rotation (Redis-backed) ────────────────────────────────────────

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL not set");
    _redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck:     false,
      lazyConnect:          true,
    });
  }
  return _redis;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function pickRotatedTemplate(
  cfg:           IndustryConfig,
  testSessionId: string,
  postType:      PostType,
  log:           Logger,
): Promise<PromptTemplateVariant> {
  const redisKey = `lastTemplateId:${testSessionId}`;
  let lastId: string | null = null;

  try {
    lastId = await getRedis().get(redisKey);
    log(`[template] session=${testSessionId.slice(0, 8)}… lastTemplateId=${lastId ?? "none"}`);
  } catch (err) {
    log(`[template] Redis read failed (${err instanceof Error ? err.message : String(err)}) — picking randomly`);
  }

  // Filter to templates matching the AI-chosen post type; fall back to full pool.
  const matchingType = cfg.templates.filter((t) => t.postType === postType);
  const typePool     = matchingType.length > 0 ? matchingType : cfg.templates;
  log(`[template] postType=${postType} → ${typePool.length} candidate(s) before rotation filter`);

  const candidates = lastId ? typePool.filter((t) => t.id !== lastId) : typePool;
  const pool = candidates.length > 0 ? candidates : typePool;
  return pickRandom(pool);
}

async function writeTemplateId(
  testSessionId: string,
  templateId:    string,
  log:           Logger,
): Promise<void> {
  try {
    // 24-hour TTL — test sessions don't need indefinite persistence.
    await getRedis().set(`lastTemplateId:${testSessionId}`, templateId, "EX", 86400);
    log(`[template] wrote lastTemplateId=${templateId} (session=${testSessionId.slice(0, 8)}…)`);
  } catch (err) {
    log(`[template] Redis write failed (${err instanceof Error ? err.message : String(err)}) — rotation state not persisted`);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleStudioTestGenerate(
  req: Request,
  res: ExpressResponse,
): Promise<void> {
  const logs: string[] = [];
  const log: Logger = (msg) => { console.log(msg); logs.push(msg); };

  try {
    log(`[studio-test] START ${new Date().toISOString()}`);

    // ── 1. Validate inputs ─────────────────────────────────────────────────
    const {
      brandName,
      industry,
      tone,
      primaryColor,
      accentColor,
      brandTagline: rawTagline,
      testSessionId: rawSessionId,
    } = req.body as {
      brandName?:    string;
      industry?:     string;
      tone?:         string;
      primaryColor?: string;
      accentColor?:  string;
      brandTagline?: string;
      testSessionId?: string;
    };

    const testSessionId = rawSessionId?.trim() || randomUUID();
    const brandTagline  = rawTagline?.trim()   || "";

    if (!brandName?.trim() || !industry?.trim() || !tone?.trim()) {
      res.status(400).json({
        success: false, data: null,
        error: "brandName, industry, and tone are required",
      });
      return;
    }

    const uploadedFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
    const productFile   = uploadedFiles?.["image"]?.[0];
    const logoFile      = uploadedFiles?.["logo"]?.[0];

    if (!productFile) {
      res.status(400).json({
        success: false, data: null,
        error: "Product image file is required",
      });
      return;
    }

    const originalBuffer = productFile.buffer;
    log(`[studio-test] product received — ${originalBuffer.length} bytes, ${productFile.mimetype}`);

    // ── 2. Upload product to Cloudinary ───────────────────────────────────
    log("[studio-test] uploading product to Cloudinary...");
    const productImageUrl = await uploadBuf(originalBuffer, "brandefai/studio-test/products");
    log(`[studio-test] product uploaded: ${productImageUrl}`);

    // ── 3. BG removal + Creative Director in parallel ─────────────────────
    log("[studio-test] background removal + creative analysis in parallel…");
    const [bgSettled, creativeSettled] = await Promise.allSettled([
      removeBackground(productImageUrl, log),
      analyzeCreative({
        imageUrl:  productImageUrl,
        brandName,
        brandTone: tone.split(",").map((s) => s.trim()).filter(Boolean),
        brandHex:  [primaryColor, accentColor].filter((c): c is string => Boolean(c)),
        log,
      }),
    ]);

    let bgRemovalPath: "cutout" | "fallback" = "fallback";
    let cutoutBuffer: Buffer = originalBuffer;

    if (bgSettled.status === "fulfilled") {
      cutoutBuffer  = bgSettled.value;
      bgRemovalPath = "cutout";
      log(`[studio-test] background removal OK — ${cutoutBuffer.length} bytes transparent PNG [CUTOUT path]`);
    } else {
      const msg = bgSettled.reason instanceof Error ? bgSettled.reason.message : String(bgSettled.reason);
      log(`[studio-test] background removal FAILED: ${msg} — using original photo as cutout [FALLBACK path]`);
    }

    const analysis: CreativeAnalysis =
      creativeSettled.status === "fulfilled"
        ? creativeSettled.value
        : { ...CREATIVE_FALLBACK, placementNotes: "creative analysis unavailable" };
    log(
      `[studio-test] creative — productType=${analysis.productType} bodyPart=${analysis.bodyPart} ` +
      `postType=${analysis.postType} headline="${analysis.headline}"`,
    );
    log(`[studio-test] trustBullets: ${JSON.stringify(analysis.trustBullets)}`);

    // ── 4. Optional logo ──────────────────────────────────────────────────
    let logoBuffer: Buffer | undefined;
    let logoUrl: string | undefined;
    if (logoFile) {
      log("[studio-test] uploading logo to Cloudinary...");
      logoUrl    = await uploadBuf(logoFile.buffer, "brandefai/studio-test/logos");
      logoBuffer = logoFile.buffer;
      log(`[studio-test] logo uploaded: ${logoUrl} (${logoFile.buffer.length} bytes)`);
    } else {
      log("[studio-test] no logo provided — brand initials will be shown in circle");
    }

    // ── 5. Template rotation (Redis-backed, drives postType-aware variety) ─
    let templateId: string | undefined;
    const cfg = getIndustryConfig(industry);
    if (cfg) {
      const template = await pickRotatedTemplate(cfg, testSessionId, analysis.postType, log);
      templateId     = template.id;
      await writeTemplateId(testSessionId, templateId, log);
      log(`[template] selected id=${templateId} compositionStyle="${template.compositionStyle}"`);
    } else {
      log(`[studio-test] no industryConfig for "${industry}" — template rotation skipped`);
    }

    // ── 6. Build promo post ────────────────────────────────────────────────
    log("[studio-test] building promo post (Sharp compositing)…");
    const promoBuf = await buildPromoPost({
      productBuffer: originalBuffer,
      cutoutBuffer,
      logoBuffer,
      brandName,
      brandTagline,
      headline:    analysis.headline,
      subheadline: analysis.subheadline,
      cta:         analysis.cta,
      trustBullets: analysis.trustBullets,
      primaryColor: primaryColor || "#1A7A4A",
      accentColor:  accentColor  || "#FFD700",
      postType:     analysis.postType,
      log,
    });

    // ── 7. Upload composited result ────────────────────────────────────────
    log("[studio-test] uploading promo post to Cloudinary...");
    const compositedUrl = await uploadBuf(promoBuf, "brandefai/studio-test/composited");
    log(`[studio-test] composited uploaded: ${compositedUrl}`);

    log("[studio-test] DONE");

    res.json({
      success: true,
      data: {
        productImageUrl,
        logoUrl,
        bgRemovalPath,
        compositedUrl,
        creativeAnalysis: analysis,
        templateId,
        logs,
      },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[studio-test] FATAL: ${msg}`);
    res.status(500).json({ success: false, data: { logs }, error: msg });
  }
}
