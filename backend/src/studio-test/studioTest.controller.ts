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

import type { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import {
  compositeStudioImage,
  type TextLayerParams,
} from "./studioTestCompositing";

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

// ─── Ideogram v3 (Replicate) ─────────────────────────────────────────────────

async function generateIdeogram(prompt: string, log: Logger): Promise<Buffer> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not set");

  log("[ideogram] submitting to Replicate...");
  const createRes = await fetch(
    "https://api.replicate.com/v1/models/ideogram-ai/ideogram-v3/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=5",
      },
      body: JSON.stringify({
        input: {
          prompt,
          negative_prompt:
            "text, words, letters, logos, watermarks, people, cartoonish, CGI",
          aspect_ratio: "4:5",
          style_type: "REALISTIC",
          rendering_speed: "TURBO",
          magic_prompt_option: "OFF",
        },
      }),
    },
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
    output?: unknown[];
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

  // output may be string[] or {url:string}[]
  let imageUrl: string | undefined;
  const output = prediction.output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") imageUrl = first;
    else if (
      typeof first === "object" &&
      first !== null &&
      "url" in first
    )
      imageUrl = (first as { url: string }).url;
  }
  if (!imageUrl) throw new Error("Ideogram: no image URL in output");

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
  res: Response,
): Promise<void> {
  const logs: string[] = [];
  const log: Logger = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    log(`[studio-test] START ${new Date().toISOString()}`);

    // ── 1. Validate inputs ─────────────────────────────────────────────────
    const { brandName, industry, tone, primaryColor, accentColor } =
      req.body as {
        brandName?: string;
        industry?: string;
        tone?: string;
        primaryColor?: string;
        accentColor?: string;
      };

    if (!brandName?.trim() || !industry?.trim() || !tone?.trim()) {
      res.status(400).json({
        success: false,
        data: null,
        error: "brandName, industry, and tone are required",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        data: null,
        error: "Product image file is required",
      });
      return;
    }

    const productBuffer = req.file.buffer;
    log(
      `[studio-test] product received — ${productBuffer.length} bytes, ${req.file.mimetype}`,
    );

    // ── 2. Upload product to Cloudinary ────────────────────────────────────
    log("[studio-test] uploading product to Cloudinary...");
    const productImageUrl = await uploadBuf(
      productBuffer,
      "brandefai/studio-test/products",
    );
    log(`[studio-test] product uploaded: ${productImageUrl}`);

    // ── 3. Scene prompt ────────────────────────────────────────────────────
    const scenePrompt = buildScenePrompt(industry, tone, brandName);
    log(`[studio-test] prompt: ${scenePrompt.slice(0, 90)}…`);

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
        results,
        textParams: textCopy,
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
