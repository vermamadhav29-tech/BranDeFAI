import { v2 as cloudinary } from "cloudinary";
import { ImageSource, CreditType } from "@prisma/client";
import prisma from "../utils/prisma";
import { createError } from "../middleware/errorHandler";
import { deductCredits } from "../utils/creditUtils";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const BFL_BASE_URL = "https://api.bfl.ai/v1";

// ─── Setting inference ─────────────────────────────────────────────────────────
// Maps industry keywords to a specific, realistic environment description —
// deliberately concrete (never a generic fallback like "modern space").

const SETTING_BY_INDUSTRY: { keywords: string[]; setting: string }[] = [
  { keywords: ["food", "restaurant", "cafe", "bakery", "gelato", "ice cream", "dessert", "sweet", "catering", "kitchen"], setting: "a warm rustic cafe counter with wooden textures, linen napkins, and soft greenery in the background" },
  { keywords: ["jewel"], setting: "an elegant velvet-lined jewellery display under warm directional spotlighting" },
  { keywords: ["fashion", "apparel", "clothing", "boutique", "wear"], setting: "a sunlit boutique interior with a neutral linen backdrop and a clothing rack softly out of focus" },
  { keywords: ["beauty", "cosmetic", "skincare", "salon", "spa"], setting: "a clean marble vanity counter with soft diffused daylight" },
  { keywords: ["fitness", "gym", "yoga", "wellness"], setting: "a sunlit studio space with natural wood flooring and minimal equipment in soft focus" },
  { keywords: ["home", "decor", "furniture", "interior"], setting: "a tastefully styled living room corner with warm natural daylight" },
  { keywords: ["tech", "software", "saas", "app"], setting: "a minimalist wooden desk setup with soft ambient side lighting" },
  { keywords: ["real estate", "realty", "property"], setting: "a sunlit interior doorway of a well-designed home" },
];

const DEFAULT_SETTING = "a clean, realistic small-business storefront counter with natural daylight";

function inferSetting(brief: string, brandContext: string): string {
  const haystack = `${brief} ${brandContext}`.toLowerCase();
  const match = SETTING_BY_INDUSTRY.find((s) => s.keywords.some((k) => haystack.includes(k)));
  return match?.setting ?? DEFAULT_SETTING;
}

function inferLighting(setting: string): string {
  const naturalCues = ["window", "sunlit", "daylight", "outdoor", "garden", "cafe"];
  return naturalCues.some((c) => setting.includes(c))
    ? "soft natural window light"
    : "professional studio softbox, single key light";
}

// ─── buildFluxPrompt ────────────────────────────────────────────────────────────
// Builds the Flux 2 Pro prompt in a fixed layer order: subject, setting, lighting,
// camera, style, audience, then a fixed quality auto-add block. Deterministic —
// no AI call here (the brief itself is the subject extraction).

export interface FluxPromptResult {
  prompt: string;
  negativePrompt: string;
}

export function buildFluxPrompt(brief: string, brandContext: string, hasProductImage: boolean): FluxPromptResult {
  const subject = brief.trim();
  const setting = inferSetting(brief, brandContext);
  const lighting = inferLighting(setting);

  const referenceLine = hasProductImage
    ? "The product's exact shape, colors, and details must be preserved as in the reference photo — only the surrounding scene, lighting, and composition are newly generated."
    : "Render the product/scene as a brand-new photorealistic depiction based on the description above.";

  const layers = [
    subject,
    `Setting: ${setting}.`,
    `Lighting: ${lighting}.`,
    `Camera: shot on Sony A7R V, 85mm f/1.4 lens, shallow depth of field, bokeh background.`,
    `Style: editorial product photography, photorealistic, magazine quality, commercial shoot.`,
    `Audience: realistic Indian setting, relatable to Indian audience, authentic feel.`,
    referenceLine,
    `professional product photography, high resolution, sharp focus, natural shadows, realistic textures, commercial quality, award-winning photography`,
  ];

  if (brandContext.trim()) {
    layers.splice(1, 0, `Brand context: ${brandContext.trim().slice(0, 300)}.`);
  }

  return {
    prompt: layers.join(" "),
    negativePrompt:
      "not cartoonish, not illustrated, not CGI, not 3D render, no text in image, no logos, no watermarks, no distorted hands, no distorted faces",
  };
}

// ─── Flux API call + poll ───────────────────────────────────────────────────────

interface FluxSubmitResponse {
  id: string;
  polling_url?: string;
}

interface FluxResultResponse {
  status: "Pending" | "Ready" | "Error" | "Request Moderated" | "Content Moderated" | "Task not found";
  result?: { sample?: string };
}

async function submitFluxJob(prompt: string, negativePrompt: string): Promise<{ id: string; pollingUrl: string }> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw createError("BFL_API_KEY is not configured", 500);

  // Flux 2 Pro requires width/height to be multiples of 32. 1024x1280 is the
  // nearest valid pair that preserves the intended 4:5 portrait ratio (1080x1350).
  const res = await fetch(`${BFL_BASE_URL}/flux-pro-1.1`, {
    method: "POST",
    headers: { "x-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: negativePrompt,
      width: 1024,
      height: 1280,
      output_format: "jpeg",
      safety_tolerance: 2,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw createError(`Flux job submission failed (${res.status}): ${text.slice(0, 300)}`, 502);
  }

  const data = (await res.json()) as FluxSubmitResponse;
  if (!data.id) throw createError("Flux job submission returned no job id", 502);
  console.log(`[fluxImage] submitted | id=${data.id} | polling_url=${data.polling_url ?? "(none — using default host)"}`);

  // BFL routes jobs to regional workers — the result MUST be polled at the
  // polling_url returned here, not a manually-constructed URL, or you get 404s.
  return { id: data.id, pollingUrl: data.polling_url ?? `${BFL_BASE_URL}/get_result?id=${data.id}` };
}

async function pollFluxResult(pollingUrl: string): Promise<string> {
  const apiKey = process.env.BFL_API_KEY!;
  const maxAttempts = 60; // 60 * 2s = 2 minutes

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(pollingUrl, {
      headers: { "x-key": apiKey, "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw createError(`Flux poll failed (${res.status}): ${text.slice(0, 300)}`, 502);
    }

    const data = (await res.json()) as FluxResultResponse;

    if (data.status === "Ready") {
      const url = data.result?.sample;
      if (!url) throw createError("Flux job completed but returned no sample URL", 502);
      return url;
    }

    if (data.status === "Error" || data.status === "Request Moderated" || data.status === "Content Moderated") {
      throw createError(`Flux job failed with status: ${data.status}`, 502);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw createError("Flux job timed out after 2 minutes", 504);
}

// ─── uploadRemoteImageToCloudinary ──────────────────────────────────────────────

async function uploadRemoteImageToCloudinary(imageUrl: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    cloudinary.uploader.upload(
      imageUrl,
      { folder: "brandefai/lifestyle", resource_type: "image" },
      (err, result) => {
        if (err) return reject(new Error(`Cloudinary: ${err.message}`));
        if (!result) return reject(new Error("Cloudinary returned no result"));
        resolve(result.secure_url);
      }
    );
  });
}

// ─── generateFluxBackground ───────────────────────────────────────────────────────
// Generates a background scene via Flux 2 Pro and returns the raw image buffer.
// No DB row, no credit deduction — caller handles those.

export async function generateFluxBackground(scenePrompt: string, negativePrompt?: string): Promise<Buffer> {
  const neg = negativePrompt ?? "text, letters, words, logos, watermarks, cartoonish, CGI, 3D render, distorted";
  const { pollingUrl } = await submitFluxJob(scenePrompt, neg);
  const fluxUrl = await pollFluxResult(pollingUrl);
  const res = await fetch(fluxUrl);
  if (!res.ok) throw new Error(`Failed to download Flux image (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── generateLifestyleImage ──────────────────────────────────────────────────────
// Public entry point: builds the prompt, calls Flux 2 Pro, polls for the result,
// uploads to Cloudinary, saves a GeneratedImage row, and deducts credits.

export async function generateLifestyleImage(
  userId: string,
  brandId: string,
  brief: string
): Promise<{ imageId: string; imageUrl: string }> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand || brand.userId !== userId) throw createError("Brand not found", 404);

  const brandContext = [
    `${brand.brandName}, a ${brand.industry} brand`,
    brand.whatTheySell ? `selling ${brand.whatTheySell}` : "",
    brand.city ? `based in ${brand.city}` : "",
    brand.tone ? `with a ${brand.tone} tone` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const { prompt, negativePrompt } = buildFluxPrompt(brief, brandContext, false);

  const startedAt = Date.now();
  console.log(`[fluxImage] START | ${new Date().toISOString()}`);

  const { pollingUrl } = await submitFluxJob(prompt, negativePrompt);
  const fluxImageUrl = await pollFluxResult(pollingUrl);
  console.log(`[fluxImage] Flux done | elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  const imageUrl = await uploadRemoteImageToCloudinary(fluxImageUrl);
  console.log(`[fluxImage] Cloudinary upload done | ${imageUrl}`);

  const record = await prisma.generatedImage.create({
    data: {
      userId,
      brandId,
      originalPrompt: brief,
      enhancedPrompt: prompt,
      imageUrl,
      style: "lifestyle",
      format: "4:5",
      source: ImageSource.GENERATED,
    },
  });

  await deductCredits(prisma, userId, 5, CreditType.GENERATION, record.id);

  return { imageId: record.id, imageUrl };
}
