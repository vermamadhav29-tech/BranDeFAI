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
import sharp from "sharp";
import { buildPromoPost } from "./studioTestPromo";
import { removeBackground } from "./backgroundRemoval";
import { pickBackground, fetchBackground, analyseTone } from "./backgroundLibrary";
import { generateLiveBackdrop } from "./backgroundGenerator";
import { deriveBrandColors } from "./colorExtraction";
import { inspectLogo, type LogoHint } from "./logoVision";
import { tryAutoKeyFlatBackground, opacityRatio, type Tone } from "./studioTestAssets";
import type { LayoutId } from "./designSystem";
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
      brandTagline: rawTagline,
      locale: rawLocale,
      testSessionId: rawSessionId,
    } = req.body as {
      brandName?:    string;
      industry?:     string;
      tone?:         string;
      brandTagline?: string;
      locale?:       string;
      testSessionId?: string;
    };

    const testSessionId = rawSessionId?.trim() || randomUUID();
    const brandTagline  = rawTagline?.trim()   || "";
    const locale        = rawLocale?.trim()    || "IN";

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

    // ── 2. Upload product + logo to Cloudinary ─────────────────────────────
    log("[studio-test] uploading product to Cloudinary...");
    const productImageUrl = await uploadBuf(originalBuffer, "brandefai/studio-test/products");
    log(`[studio-test] product uploaded: ${productImageUrl}`);

    let logoBuffer: Buffer | undefined;
    let logoUrl: string | undefined;
    if (logoFile) {
      log("[studio-test] uploading logo to Cloudinary...");
      logoUrl    = await uploadBuf(logoFile.buffer, "brandefai/studio-test/logos");
      logoBuffer = logoFile.buffer;
      log(`[studio-test] logo uploaded: ${logoUrl} (${logoFile.buffer.length} bytes)`);
    } else {
      log("[studio-test] no logo provided — brand initials will be shown");
    }

    // ── 3. BG removal + Creative Director + Logo vision, all in parallel ───
    // The logo check is cheap (~5-10s) and rides for free alongside the ~85s
    // creative pipeline — no added latency.
    log("[studio-test] background removal + creative analysis + logo check in parallel…");
    const [bgSettled, creativeSettled, logoHintSettled] = await Promise.allSettled([
      removeBackground(productImageUrl, log),
      analyzeCreative({
        imageUrl:  productImageUrl,
        brandName,
        brandTone: tone.split(",").map((s) => s.trim()).filter(Boolean),
        brandHex:  [], // colours are auto-derived from the logo/product post-analysis, not user-picked
        industry,
        locale,
        log,
      }),
      logoUrl ? inspectLogo(logoUrl, log) : Promise.resolve(null),
    ]);

    const logoHint: LogoHint | null =
      logoHintSettled.status === "fulfilled" ? logoHintSettled.value : null;

    let bgRemovalPath: "cutout" | "corner-key" | "fallback" = "fallback";
    let cutoutBuffer: Buffer = originalBuffer;

    if (bgSettled.status === "fulfilled") {
      cutoutBuffer  = bgSettled.value;
      bgRemovalPath = "cutout";
      log(`[studio-test] background removal OK — ${cutoutBuffer.length} bytes transparent PNG [CUTOUT path]`);

      // BiRefNet sometimes has nothing to remove: a tightly-framed studio photo
      // whose backdrop fills the whole frame gets classified as "all foreground",
      // returning an almost-fully-opaque result. Detect that and try a corner-
      // colour key on the original photo as a supplementary pass.
      const opacity = await opacityRatio(cutoutBuffer).catch(() => 1);
      log(`[studio-test] cutout opacity ratio=${(opacity * 100).toFixed(1)}%`);
      if (opacity > 0.97) {
        log("[studio-test] BiRefNet result is almost fully opaque — likely nothing to remove; " +
            "trying a corner-colour key on the original photo");
        const keyed = await tryAutoKeyFlatBackground(originalBuffer).catch(() => null);
        if (keyed) {
          cutoutBuffer  = keyed;
          bgRemovalPath = "corner-key";
          log("[studio-test] corner-colour key succeeded [CORNER-KEY path]");
        } else {
          log("[studio-test] corner-colour key found no uniform background — keeping BiRefNet result as-is");
        }
      }
    } else {
      const msg = bgSettled.reason instanceof Error ? bgSettled.reason.message : String(bgSettled.reason);
      log(`[studio-test] background removal FAILED: ${msg} — trying a corner-colour key on the original photo`);
      const keyed = await tryAutoKeyFlatBackground(originalBuffer).catch(() => null);
      if (keyed) {
        cutoutBuffer  = keyed;
        bgRemovalPath = "corner-key";
        log("[studio-test] corner-colour key succeeded [CORNER-KEY path]");
      } else {
        log("[studio-test] corner-colour key also found no uniform background — using original photo as-is [FALLBACK path]");
      }
    }

    const analysis: CreativeAnalysis =
      creativeSettled.status === "fulfilled"
        ? creativeSettled.value
        : { ...CREATIVE_FALLBACK, placementNotes: "creative analysis unavailable" };
    log(
      `[studio-test] creative — productType=${analysis.productType} orientation=${analysis.orientation} ` +
      `postType=${analysis.postType} layout=${analysis.layoutId} fonts=${analysis.fontPairingId} ` +
      `scene=${analysis.sceneMood} headline="${analysis.headline}" accent="${analysis.accentLine}"`,
    );
    log(`[studio-test] trustBullets: ${JSON.stringify(analysis.trustBullets)} icons: ${JSON.stringify(analysis.trustIcons)}`);

    // ── 3b. Layout safety: the real cutout aspect overrides the AI's guess ────
    let layoutId: LayoutId = analysis.layoutId;
    try {
      const m = await sharp(cutoutBuffer).metadata();
      const aspect = (m.height ?? 1) / (m.width ?? 1);
      if (aspect > 1.2 && (layoutId === "text_top_product_bottom" || layoutId === "centered_hero")) {
        layoutId = "text_left_product_right";
        log(`[studio-test] cutout is tall (h/w=${aspect.toFixed(2)}) — layout overridden → ${layoutId}`);
      } else if (aspect < 0.8 && (layoutId === "text_left_product_right" || layoutId === "text_right_product_left")) {
        layoutId = "text_top_product_bottom";
        log(`[studio-test] cutout is wide (h/w=${aspect.toFixed(2)}) — layout overridden → ${layoutId}`);
      }
    } catch (_) { /* keep AI layout */ }

    // ── 3d. Auto-derive brand colours from the logo, or fall back to the product ──
    const derivedColors = await deriveBrandColors(logoBuffer, cutoutBuffer, log);

    // ── 3e. Backdrop: generate live from the Art Director's bespoke scene;
    //        fall back to the pre-rendered library, then to a blurred-photo backdrop.
    let backgroundBuffer: Buffer | undefined;
    let backgroundTone: Tone = "dark";
    let backgroundSource = "fallback";

    try {
      const liveRaw = await generateLiveBackdrop(analysis.sceneDescription, log);
      backgroundBuffer = await sharp(liveRaw).resize(1080, 1080, { fit: "cover", position: "centre" }).png().toBuffer();
      const toneInfo = await analyseTone(backgroundBuffer);
      backgroundTone   = toneInfo.tone;
      backgroundSource = "live";
      log(`[studio-test] live backdrop ready — tone=${toneInfo.tone} dominant=${toneInfo.dominant}`);
    } catch (err) {
      log(`[studio-test] live backdrop failed: ${err instanceof Error ? err.message : String(err)} — trying library`);
      try {
        const item = pickBackground(industry, analysis.sceneMood);
        if (item) {
          backgroundBuffer = await fetchBackground(item);
          backgroundTone   = item.tone;
          backgroundSource = `library:${item.id}`;
          log(`[studio-test] library backdrop ${item.id} (${item.tone}, ${item.dominant})`);
        } else {
          log(`[studio-test] no library backdrop for industry="${industry}" mood="${analysis.sceneMood}" — using blurred-photo fallback`);
        }
      } catch (err2) {
        log(`[studio-test] library backdrop also failed: ${err2 instanceof Error ? err2.message : String(err2)} — using blurred-photo fallback`);
      }
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
    log("[studio-test] rendering promo post…");
    const promoBuf = await buildPromoPost({
      productBuffer:    originalBuffer,
      cutoutBuffer,
      logoBuffer,
      logoHint,
      backgroundBuffer,
      backgroundTone,
      brandName,
      brandTagline,
      headline:         analysis.headline,
      accentLine:       analysis.accentLine,
      subheadline:      analysis.subheadline,
      cta:              analysis.cta,
      trustBullets:     analysis.trustBullets,
      trustIcons:       analysis.trustIcons,
      primaryColor:     derivedColors.primary,
      accentColor:      derivedColors.accent,
      layoutId,
      fontPairingId:    analysis.fontPairingId,
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
        creativeAnalysis: { ...analysis, layoutId },
        backgroundSource,
        backgroundTone,
        derivedColors,
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
