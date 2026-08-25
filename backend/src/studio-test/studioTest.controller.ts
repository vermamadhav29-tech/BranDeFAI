/**
 * studioTest.controller.ts
 *
 * Fully self-contained handler for POST /api/studio-test/generate.
 * Imports NOTHING from the existing service pipeline — no autoCreative,
 * no creativeBrief, no existing upload helpers, no Brand DNA lookup.
 *
 * Own Cloudinary upload, own Flux polling, own Ideogram/Replicate polling,
 * own compositing (via studioTestCompositing.ts).
 */

import { randomUUID } from "crypto";
import type { Request, Response as ExpressResponse } from "express";
import { v2 as cloudinary } from "cloudinary";
import Redis from "ioredis";
import {
  compositeStudioImage,
  type TextLayerParams,
} from "./studioTestCompositing";
import { removeBackground } from "./backgroundRemoval";
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
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function uploadBuf(buf: Buffer, folder: string): Promise<string> {
  cfgCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => {
        if (err) return reject(new Error(`Cloudinary error: ${err.message}`));
        if (!result) return reject(new Error("Cloudinary returned no result"));
        resolve(result.secure_url);
      },
    );
    stream.end(buf);
  });
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const SETTINGS: Record<string, string> = {
  jewellery:
    "elegant marble and velvet jewellery display surface, deep jewel-toned background with golden accents, dramatic directional studio lighting",
  food_desserts:
    "warm rustic cafe counter with wooden textures and linen, morning light streaming in, artisan pastry and greenery display, bokeh",
  lifestyle:
    "clean minimalist interior studio space, neutral warm tones, natural daylight, Scandinavian aesthetic",
};

function buildScenePrompt(
  industry: string,
  tone: string,
  brandName: string,
): string {
  const toneWords = tone
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  const setting = SETTINGS[industry] ?? SETTINGS.lifestyle;
  return [
    `Luxury commercial product photography background for ${brandName}.`,
    `Setting: ${setting}.`,
    `Mood: ${toneWords}.`,
    `Style: ${toneWords} editorial photography, photorealistic, magazine quality, commercial shoot.`,
    `Camera: Sony A7R V 85mm f/1.4 lens, shallow depth of field, beautiful bokeh.`,
    `Lighting: professional studio three-point lighting with soft natural fill.`,
    `No text, no people, no product objects, no watermarks. Ultra HD 8K.`,
  ].join(" ");
}

function buildTextCopy(
  brandName: string,
  industry: string,
  tone: string,
): Pick<TextLayerParams, "headline" | "subheadline" | "cta"> {
  const toneWord =
    tone
      .split(",")[0]
      ?.trim()
      .replace(/^\w/, (c) => c.toUpperCase()) ?? "Premium";

  if (industry === "jewellery")
    return {
      headline: "Crafted to Last",
      subheadline: `${toneWord} jewellery for every precious moment`,
      cta: "Shop Now",
    };
  if (industry === "food_desserts")
    return {
      headline: "Taste the Difference",
      subheadline: `${toneWord} flavours, made with love`,
      cta: "Order Now",
    };
  return {
    headline: `Live ${toneWord}`,
    subheadline: `Discover the ${brandName} collection`,
    cta: "Explore Now",
  };
}

// ─── Template rotation (Redis-backed) ────────────────────────────────────────
// Uses the shared Redis instance (REDIS_URL) to track lastTemplateId per
// testSessionId. All errors are swallowed — rotation degrades gracefully to
// random selection if Redis is unavailable.

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL not set");
    _redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return _redis;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function pickRotatedTemplate(
  cfg: IndustryConfig,
  testSessionId: string,
  log: Logger,
): Promise<PromptTemplateVariant> {
  const redisKey = `lastTemplateId:${testSessionId}`;
  let lastId: string | null = null;

  try {
    lastId = await getRedis().get(redisKey);
    log(
      `[template] session=${testSessionId.slice(0, 8)}… lastTemplateId=${lastId ?? "none"}`,
    );
  } catch (err) {
    log(
      `[template] Redis read failed (${err instanceof Error ? err.message : String(err)}) — picking randomly`,
    );
  }

  // Exclude the last-used template so composition style rotates each call.
  // If only one template exists (or all are the last-used), fall back to full pool.
  const candidates = lastId
    ? cfg.templates.filter((t) => t.id !== lastId)
    : cfg.templates;
  const pool = candidates.length > 0 ? candidates : cfg.templates;
  return pickRandom(pool);
}

async function writeTemplateId(
  testSessionId: string,
  templateId: string,
  log: Logger,
): Promise<void> {
  try {
    // 24-hour TTL — test sessions don't need indefinite persistence.
    await getRedis().set(
      `lastTemplateId:${testSessionId}`,
      templateId,
      "EX",
      86400,
    );
    log(
      `[template] wrote lastTemplateId=${templateId} (session=${testSessionId.slice(0, 8)}…)`,
    );
  } catch (err) {
    log(
      `[template] Redis write failed (${err instanceof Error ? err.message : String(err)}) — rotation state not persisted`,
    );
  }
}

function fillSkeleton(skeleton: string, slots: Record<string, string>): string {
  return skeleton.replace(/\{([A-Z_]+)\}/g, (_, key: string) => slots[key] ?? `{${key}}`);
}

// Fills the industry template's promptSkeleton with form values and sensible
// defaults for slots the studio-test form doesn't collect yet.
// The skeleton's negative-prompt language is preserved verbatim — that's what
// suppresses off-brand elements in the generated image.
function buildTemplateScenePrompt(
  cfg: IndustryConfig,
  template: PromptTemplateVariant,
  brandName: string,
  tone: string,
  primaryColor: string,
): string {
  const toneWords = tone
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  // Two distinct picks from materialVocab for MATERIAL and FINISH.
  const mat1 = pickRandom(cfg.materialVocab);
  const mat2Pool = cfg.materialVocab.filter((m) => m !== mat1);
  const mat2 = mat2Pool.length > 0 ? pickRandom(mat2Pool) : mat1;

  const slots: Record<string, string> = {
    PRODUCT:     "the product as shown in the photo",
    BRAND_NAME:  brandName,
    BRAND_TONE:  toneWords,
    BRAND_HEX:   primaryColor,
    MATERIAL:    mat1,
    FINISH:      mat2,
    BACKDROP:    pickRandom(template.backdropOptions),
    SURFACE:     pickRandom(template.backdropOptions),
    FOCAL_POINT: "the product",
    BODY_PART:   pickRandom(["wrist", "neck", "hand", "ear"]),
    SETTING:     pickRandom(template.backdropOptions),
    GARNISH:     pickRandom(cfg.materialVocab),
    PROPS:       "complementary lifestyle props",
  };

  return fillSkeleton(template.promptSkeleton, slots);
}

// ─── Flux 2 Pro (BFL) ────────────────────────────────────────────────────────

async function generateFlux(prompt: string, log: Logger): Promise<Buffer> {
  const key = process.env.BFL_API_KEY;
  if (!key) throw new Error("BFL_API_KEY not set");

  log("[flux] submitting job...");
  const submitRes = await fetch("https://api.bfl.ai/v1/flux-pro-1.1", {
    method: "POST",
    headers: { "x-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt:
        "text, letters, words, logos, watermarks, people, CGI, 3D render, distorted, blurry",
      width: 1024,
      height: 1280,
      output_format: "jpeg",
      safety_tolerance: 2,
    }),
  });

  if (!submitRes.ok) {
    const txt = await submitRes.text().catch(() => "");
    throw new Error(
      `Flux submit HTTP ${submitRes.status}: ${txt.slice(0, 300)}`,
    );
  }

  const submitData = (await submitRes.json()) as {
    id?: string;
    polling_url?: string;
  };
  if (!submitData.id) throw new Error("Flux: no job id returned");

  const pollUrl =
    submitData.polling_url ??
    `https://api.bfl.ai/v1/get_result?id=${submitData.id}`;
  log(`[flux] polling: ${pollUrl}`);

  for (let attempt = 1; attempt <= 70; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, {
      headers: { "x-key": key, "Content-Type": "application/json" },
    });
    if (!pollRes.ok)
      throw new Error(`Flux poll HTTP ${pollRes.status}`);

    const d = (await pollRes.json()) as {
      status: string;
      result?: { sample?: string };
    };
    log(`[flux] attempt=${attempt} status=${d.status}`);

    if (d.status === "Ready") {
      const url = d.result?.sample;
      if (!url) throw new Error("Flux: ready but no sample URL");
      const imgRes = await fetch(url);
      if (!imgRes.ok)
        throw new Error(`Flux: download HTTP ${imgRes.status}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      log(`[flux] image ready — ${buf.length} bytes`);
      return buf;
    }

    if (
      ["Error", "Request Moderated", "Content Moderated"].includes(d.status)
    ) {
      throw new Error(`Flux job failed with status: ${d.status}`);
    }
  }

  throw new Error("Flux: timed out after 140s of polling");
}

// ─── 429-aware submission helper (Replicate only) ────────────────────────────
// Retries a POST up to 2 times on HTTP 429, honouring Replicate's retry_after.
// Non-429 responses are returned as-is so existing error handling is unchanged.
// Throws after MAX_RETRIES exhausted → falls through to each caller's fallback.

async function submitWithRetry429(
  url: string,
  init: RequestInit,
  log: Logger,
  tag: string,
): Promise<Response> {
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;

    let waitSec = 5;
    try {
      const body = (await res.json()) as { retry_after?: number };
      if (typeof body.retry_after === "number") waitSec = body.retry_after;
    } catch (_e) {
      // body not JSON or no retry_after field — keep 5s default
    }

    if (attempt === MAX_RETRIES) {
      throw new Error(
        `${tag} HTTP 429 — rate-limited, ${MAX_RETRIES} retries exhausted`,
      );
    }
    const delay = waitSec + 0.5;
    log(
      `${tag} HTTP 429 — retry ${attempt + 1}/${MAX_RETRIES} in ${delay}s (retry_after=${waitSec}s)`,
    );
    await new Promise((r) => setTimeout(r, delay * 1_000));
  }
  throw new Error(`${tag} submitWithRetry429: unreachable`);
}

// ─── Ideogram v3 (Replicate) ─────────────────────────────────────────────────

async function generateIdeogram(prompt: string, log: Logger): Promise<Buffer> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not set");

  const ideogramPayload = {
    input: {
      prompt,
      negative_prompt:
        "text, words, letters, logos, watermarks, people, cartoonish, CGI",
      aspect_ratio: "4:5",
      style_type: "Realistic",      // accepted values: None Auto General Realistic Design
      magic_prompt_option: "Off",   // accepted values: Auto On Off
    },
  };
  log(`[ideogram] payload: ${JSON.stringify(ideogramPayload.input)}`);
  const createRes = await submitWithRetry429(
    "https://api.replicate.com/v1/models/ideogram-ai/ideogram-v3-turbo/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=5",
      },
      body: JSON.stringify(ideogramPayload),
    },
    log,
    "[ideogram]",
  );

  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => "");
    throw new Error(
      `Ideogram submit HTTP ${createRes.status}: ${txt.slice(0, 300)}`,
    );
  }

  type PredictionShape = {
    id: string;
    status: string;
    urls?: { get: string };
    output?: unknown;   // may be string | string[] | {url:string}[] depending on model version
    error?: string;
  };

  let prediction = (await createRes.json()) as PredictionShape;
  log(
    `[ideogram] prediction id=${prediction.id} status=${prediction.status}`,
  );

  const getUrl =
    prediction.urls?.get ??
    `https://api.replicate.com/v1/predictions/${prediction.id}`;

  for (let attempt = 1; attempt <= 70; attempt++) {
    if (prediction.status === "succeeded") break;
    if (
      prediction.status === "failed" ||
      prediction.status === "canceled"
    ) {
      throw new Error(
        `Ideogram prediction ${prediction.status}: ${prediction.error ?? "unknown"}`,
      );
    }

    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pollRes.ok)
      throw new Error(`Ideogram poll HTTP ${pollRes.status}`);
    prediction = (await pollRes.json()) as PredictionShape;
    log(
      `[ideogram] attempt=${attempt} status=${prediction.status}`,
    );
  }

  if (prediction.status !== "succeeded")
    throw new Error("Ideogram: timed out");

  // Log the raw output so its shape is visible in the server logs panel.
  log(`[ideogram] raw output: ${JSON.stringify(prediction.output)}`);

  // Parse whichever shape Replicate actually returns for this model.
  // Ideogram v3-turbo returns a plain string URL (confirmed by log above).
  let imageUrl: string | undefined;
  const output = prediction.output;
  if (typeof output === "string" && output.length > 0) {
    // plain string — most common for newer Replicate model deployments
    imageUrl = output;
  } else if (Array.isArray(output) && output.length > 0) {
    // array variant — kept as fallback in case the model changes
    const first = output[0];
    if (typeof first === "string") imageUrl = first;
    else if (typeof first === "object" && first !== null && "url" in first)
      imageUrl = (first as { url: string }).url;
  }
  if (!imageUrl) throw new Error(`Ideogram: no image URL in output — shape was: ${JSON.stringify(output)}`);

  log(`[ideogram] image URL: ${imageUrl}`);
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok)
    throw new Error(`Ideogram: download HTTP ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  log(`[ideogram] image ready — ${buf.length} bytes`);
  return buf;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleStudioTestGenerate(
  req: Request,
  res: ExpressResponse,
): Promise<void> {
  const logs: string[] = [];
  const log: Logger = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    log(`[studio-test] START ${new Date().toISOString()}`);

    // ── 1. Validate inputs ─────────────────────────────────────────────────
    const {
      brandName,
      industry,
      tone,
      primaryColor,
      accentColor,
      testSessionId: rawSessionId,
    } = req.body as {
      brandName?: string;
      industry?: string;
      tone?: string;
      primaryColor?: string;
      accentColor?: string;
      testSessionId?: string;
    };

    // testSessionId drives template rotation — generate one if the client
    // didn't send it (e.g. direct curl tests).
    const testSessionId = rawSessionId?.trim() || randomUUID();

    if (!brandName?.trim() || !industry?.trim() || !tone?.trim()) {
      res.status(400).json({
        success: false,
        data: null,
        error: "brandName, industry, and tone are required",
      });
      return;
    }

    // req.files is Record<fieldname, File[]> when using upload.fields()
    const uploadedFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
    const productFile = uploadedFiles?.["image"]?.[0];
    const logoFile    = uploadedFiles?.["logo"]?.[0];

    if (!productFile) {
      res.status(400).json({
        success: false,
        data: null,
        error: "Product image file is required",
      });
      return;
    }

    // let — will be reassigned to transparent PNG after background removal
    let productBuffer = productFile.buffer;
    log(
      `[studio-test] product received — ${productBuffer.length} bytes, ${productFile.mimetype}`,
    );

    // ── 2. Upload product (+ optional logo) to Cloudinary ─────────────────
    log("[studio-test] uploading product to Cloudinary...");
    const productImageUrl = await uploadBuf(
      productBuffer,
      "brandefai/studio-test/products",
    );
    log(`[studio-test] product uploaded: ${productImageUrl}`);

    // ── 2b. Background removal via BiRefNet (men1scus/birefnet) ───────────
    // Runs once here — model-independent, result is reused for both composites.
    // On failure: logs the error and falls back to the original photo buffer.
    let bgRemovalPath: "cutout" | "fallback" = "fallback";
    try {
      const cutout = await removeBackground(productImageUrl, log);
      productBuffer = cutout;
      bgRemovalPath = "cutout";
      log(
        `[studio-test] background removal OK — ${cutout.length} bytes transparent PNG [CUTOUT path]`,
      );
    } catch (bgErr) {
      const msg = bgErr instanceof Error ? bgErr.message : String(bgErr);
      log(
        `[studio-test] background removal FAILED: ${msg} — compositing original photo as-is [FALLBACK path]`,
      );
      // productBuffer stays as productFile.buffer (original JPEG)
    }
    log(`[studio-test] bg removal path: ${bgRemovalPath}`);

    let logoBuffer: Buffer | undefined;
    let logoUrl: string | undefined;
    if (logoFile) {
      log("[studio-test] uploading logo to Cloudinary...");
      logoUrl = await uploadBuf(logoFile.buffer, "brandefai/studio-test/logos");
      logoBuffer = logoFile.buffer;
      log(`[studio-test] logo uploaded: ${logoUrl} (${logoFile.buffer.length} bytes, ${logoFile.mimetype})`);
    } else {
      log("[studio-test] no logo provided — overlay step will be skipped");
    }

    // ── 3. Scene prompt (template rotation) ───────────────────────────────
    let scenePrompt: string;
    let templateId: string | undefined;

    const cfg = getIndustryConfig(industry);
    if (cfg) {
      const template = await pickRotatedTemplate(cfg, testSessionId, log);
      templateId = template.id;
      scenePrompt = buildTemplateScenePrompt(
        cfg,
        template,
        brandName,
        tone,
        primaryColor || "#1A7A4A",
      );
      log(
        `[template] using id=${templateId} compositionStyle="${template.compositionStyle}"`,
      );
    } else {
      scenePrompt = buildScenePrompt(industry, tone, brandName);
      log(
        `[studio-test] no industryConfig for "${industry}" — using legacy prompt builder`,
      );
    }
    log(`[studio-test] full prompt sent to Flux+Ideogram: ${scenePrompt}`);

    // ── 4. Generate Flux + Ideogram in parallel ────────────────────────────
    log("[studio-test] firing Flux + Ideogram in parallel...");
    const [fluxSettled, ideogramSettled] = await Promise.allSettled([
      generateFlux(scenePrompt, log),
      generateIdeogram(scenePrompt, log),
    ]);

    if (fluxSettled.status === "rejected")
      log(`[studio-test] Flux FAILED: ${fluxSettled.reason}`);
    else log(`[studio-test] Flux OK — ${fluxSettled.value.length} bytes`);

    if (ideogramSettled.status === "rejected")
      log(`[studio-test] Ideogram FAILED: ${ideogramSettled.reason}`);
    else
      log(
        `[studio-test] Ideogram OK — ${ideogramSettled.value.length} bytes`,
      );

    // Write rotation state only when at least one model succeeded.
    if (
      templateId &&
      (fluxSettled.status === "fulfilled" ||
        ideogramSettled.status === "fulfilled")
    ) {
      await writeTemplateId(testSessionId, templateId, log);
    }

    if (
      fluxSettled.status === "rejected" &&
      ideogramSettled.status === "rejected"
    ) {
      res.status(502).json({
        success: false,
        data: { logs },
        error: "Both Flux and Ideogram failed — see logs",
      });
      return;
    }

    // ── 5. Text copy ───────────────────────────────────────────────────────
    const textCopy = buildTextCopy(brandName, industry, tone);
    const textParams: TextLayerParams = {
      brandName,
      ...textCopy,
      primaryColor: primaryColor || "#1A7A4A",
      accentColor: accentColor || "#FFD700",
    };
    log(`[studio-test] headline="${textCopy.headline}" cta="${textCopy.cta}"`);

    // ── 6. Upload raw + composite each model result ────────────────────────
    type ModelResult = {
      label: string;
      rawUrl: string;
      compositedUrl: string;
    };

    const modelTasks: Array<Promise<ModelResult>> = [];

    if (fluxSettled.status === "fulfilled") {
      const fluxBuf = fluxSettled.value;
      modelTasks.push(
        (async (): Promise<ModelResult> => {
          log("[studio-test][flux] uploading raw bg...");
          const rawUrl = await uploadBuf(
            fluxBuf,
            "brandefai/studio-test/flux-raw",
          );
          log(`[studio-test][flux] raw uploaded: ${rawUrl}`);

          log("[studio-test][flux] compositing...");
          const compositedBuf = await compositeStudioImage({
            backgroundBuffer: fluxBuf,
            productBuffer,
            logoBuffer,  // undefined = skip logo overlay
            text: textParams,
            log,
          });
          const compositedUrl = await uploadBuf(
            compositedBuf,
            "brandefai/studio-test/flux-composited",
          );
          log(`[studio-test][flux] composited: ${compositedUrl}`);
          return { label: "Flux 2 Pro", rawUrl, compositedUrl };
        })(),
      );
    }

    if (ideogramSettled.status === "fulfilled") {
      const ideoBuf = ideogramSettled.value;
      modelTasks.push(
        (async (): Promise<ModelResult> => {
          log("[studio-test][ideogram] uploading raw bg...");
          const rawUrl = await uploadBuf(
            ideoBuf,
            "brandefai/studio-test/ideogram-raw",
          );
          log(`[studio-test][ideogram] raw uploaded: ${rawUrl}`);

          log("[studio-test][ideogram] compositing...");
          const compositedBuf = await compositeStudioImage({
            backgroundBuffer: ideoBuf,
            productBuffer,
            logoBuffer,  // undefined = skip logo overlay
            text: textParams,
            log,
          });
          const compositedUrl = await uploadBuf(
            compositedBuf,
            "brandefai/studio-test/ideogram-composited",
          );
          log(`[studio-test][ideogram] composited: ${compositedUrl}`);
          return { label: "Ideogram v3", rawUrl, compositedUrl };
        })(),
      );
    }

    const settled = await Promise.allSettled(modelTasks);
    const results: ModelResult[] = [];
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value);
      else log(`[studio-test] pipeline task FAILED: ${s.reason}`);
    }

    log(`[studio-test] DONE — ${results.length} result(s)`);

    res.json({
      success: true,
      data: {
        productImageUrl,
        logoUrl,
        bgRemovalPath,    // "cutout" | "fallback" — visible in server logs panel
        results,
        textParams: textCopy,
        templateId,       // which variant was used this generation
        logs,
      },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[studio-test] FATAL: ${msg}`);
    res
      .status(500)
      .json({ success: false, data: { logs }, error: msg });
  }
}
