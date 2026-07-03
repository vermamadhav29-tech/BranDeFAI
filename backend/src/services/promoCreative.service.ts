import Replicate from "replicate";
import { v2 as cloudinary } from "cloudinary";
import sharp, { OverlayOptions } from "sharp";
import { ImageSource, CreditType } from "@prisma/client";
import prisma from "../utils/prisma";
import { createError } from "../middleware/errorHandler";
import { deductCredits } from "../utils/creditUtils";
import type { BrandDNA } from "./brandDNA.service";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const BANNER_HEIGHT = Math.round(CANVAS_HEIGHT * 0.18); // 243px
const LOGO_WIDTH_RATIO = 0.15;
const LOGO_MARGIN = 40;
const LOGO_BANNER_GAP = 20; // min px between logo bottom edge and CTA banner top
const LOGO_SHADOW_BLUR = 6;
const LOGO_SHADOW_OFFSET = 5;
const BADGE_WIDTH = 160;
const BADGE_HEIGHT = 36;
const BADGE_RADIUS = 18;
const BADGE_MARGIN = 20;

// BranDeFAI design system colors (CLAUDE.md) — used when a brand has no logo,
// or color extraction can't find a meaningful non-background color.
const DEFAULT_PRIMARY_COLOR = "#1A7A4A";
const DEFAULT_SECONDARY_COLOR = "#1A2E44";

// ─── buildIdeogramPrompt ───────────────────────────────────────────────────────

export interface IdeogramPromptResult {
  prompt: string;
  negativePromptNote: string;
}

export function buildIdeogramPrompt(brief: string, businessType: string, visualMood: string): IdeogramPromptResult {
  // Ideogram v3 on Replicate (per the exact input shape used in generateBackgroundBuffer)
  // has no separate negative_prompt field, so the "avoid" list is folded into the prompt.
  const negativePromptNote = "text, letters, words, logos, watermarks, cartoonish, CGI";

  const prompt = [
    `A professional promotional social media background for an Indian ${businessType} brand.`,
    `${visualMood} aesthetic. ${brief.trim()} in frame.`,
    `Clean negative space in the BOTTOM 20% of image for text overlay.`,
    `IMPORTANT: No text, no letters, no logos, no numbers anywhere in the image.`,
    `Photorealistic, high quality, commercial photography style.`,
    `Avoid: ${negativePromptNote}.`,
  ].join(" ");

  return { prompt, negativePromptNote };
}

// ─── Replicate / Ideogram v3 ────────────────────────────────────────────────────

async function fetchBufferFromUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw createError(`Failed to download image (${res.status}): ${url}`, 502);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateBackgroundBuffer(prompt: string): Promise<Buffer> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) throw createError("REPLICATE_API_TOKEN is not configured", 500);

  const replicate = new Replicate({ auth: apiToken });

  // "ideogram-ai/ideogram-v3" (the literal slug) doesn't exist on Replicate — v3 is
  // split into -turbo/-quality/-balanced tiers. -quality matches the "high quality,
  // commercial photography style" requirement in the prompt itself.
  const output = await replicate.run("ideogram-ai/ideogram-v3-quality", {
    input: { prompt, aspect_ratio: "4:5", magic_prompt_option: "Auto" },
  });

  // replicate-js may resolve image outputs as a FileOutput (has .url()), a plain
  // URL string, or an array of either — depending on model and client version.
  const item = Array.isArray(output) ? output[0] : output;

  let imageUrl: string;
  if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "function") {
    imageUrl = (item as { url(): URL }).url().toString();
  } else if (typeof item === "string") {
    imageUrl = item;
  } else {
    throw createError("Unexpected response format from Ideogram v3", 502);
  }

  console.log(`[promoCreative] Ideogram image URL: ${imageUrl}`);
  return fetchBufferFromUrl(imageUrl);
}

// ─── Dominant color extraction ──────────────────────────────────────────────────
// sharp().stats() only returns a single per-channel average — useful for an overall
// tint, but not a real "dominant color", and can't yield a meaningfully distinct
// second color. Instead we downscale the logo and bucket raw pixels into a coarse
// color histogram via sharp's .raw() output, skipping transparent/near-white/
// near-black pixels (typical logo backgrounds), then take the top 2 buckets.

export async function extractDominantColors(imageBuffer: Buffer): Promise<{ primary: string; secondary: string }> {
  const { data, info } = await sharp(imageBuffer)
    .resize(64, 64, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const channels = info.channels;

  for (let i = 0; i + channels <= data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels >= 4 ? data[i + 3] : 255;
    if (a < 128) continue;

    const brightness = (r + g + b) / 3;
    if (brightness > 245 || brightness < 12) continue;

    const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);

  const toHex = (bucket: { count: number; r: number; g: number; b: number }): string => {
    const r = Math.round(bucket.r / bucket.count);
    const g = Math.round(bucket.g / bucket.count);
    const b = Math.round(bucket.b / bucket.count);
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  };

  return {
    primary: sorted[0] ? toHex(sorted[0]) : DEFAULT_PRIMARY_COLOR,
    secondary: sorted[1] ? toHex(sorted[1]) : DEFAULT_SECONDARY_COLOR,
  };
}

// ─── POST /api/brand/extract-color ─────────────────────────────────────────────
// Extracts and persists the brand's logo colors. Called once after logo upload
// (frontend) so promo-creative generation never has to recompute it.

export async function extractBrandColorFromLogo(
  userId: string
): Promise<{ logoColorPrimary: string; logoColorSecondary: string }> {
  const brand = await prisma.brand.findUnique({ where: { userId } });
  if (!brand) throw createError("Brand not found", 404);
  if (!brand.logoUrl) throw createError("Brand has no logo set", 400);

  const logoBuffer = await fetchBufferFromUrl(brand.logoUrl);
  const { primary, secondary } = await extractDominantColors(logoBuffer);

  const updated = await prisma.brand.update({
    where: { userId },
    data: { logoColorPrimary: primary, logoColorSecondary: secondary },
  });

  return { logoColorPrimary: updated.logoColorPrimary!, logoColorSecondary: updated.logoColorSecondary! };
}

// ─── Logo overlay with drop shadow (Sharp) ─────────────────────────────────────

interface LogoLayer {
  buffer: Buffer;
  pad: number;
  logoWidth: number;
  logoHeight: number;
}

async function buildLogoWithShadow(logoBuffer: Buffer, canvasWidth: number): Promise<LogoLayer> {
  const targetWidth = Math.round(canvasWidth * LOGO_WIDTH_RATIO);
  const resizedLogo = await sharp(logoBuffer).resize({ width: targetWidth }).ensureAlpha().toBuffer();
  const meta = await sharp(resizedLogo).metadata();
  const logoWidth = meta.width!;
  const logoHeight = meta.height!;

  // Pad the working canvas so the blurred shadow isn't clipped at the edges.
  const pad = LOGO_SHADOW_BLUR * 2 + LOGO_SHADOW_OFFSET;
  const canvasW = logoWidth + pad * 2;
  const canvasH = logoHeight + pad * 2;

  const shadow = await sharp(resizedLogo).ensureAlpha().tint({ r: 0, g: 0, b: 0 }).blur(LOGO_SHADOW_BLUR).toBuffer();

  const buffer = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: shadow, left: pad + LOGO_SHADOW_OFFSET, top: pad + LOGO_SHADOW_OFFSET },
      { input: resizedLogo, left: pad, top: pad },
    ])
    .png()
    .toBuffer();

  return { buffer, pad, logoWidth, logoHeight };
}

// ─── CTA banner + occasion badge (SVG rasterized via Sharp) ────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Approximate average glyph width (as a fraction of font size) for bold sans-serif —
// used to auto-scale text to fill a target pixel width without a real text-measuring API.
const AVG_BOLD_CHAR_WIDTH_RATIO = 0.58;

function buildCtaBannerSvg(width: number, bannerHeight: number, bgColorHex: string, ctaText: string): Buffer {
  const text = ctaText.trim().toUpperCase();
  const targetTextWidth = width * 0.8;
  let fontSize = targetTextWidth / Math.max(1, text.length * AVG_BOLD_CHAR_WIDTH_RATIO);
  fontSize = Math.max(18, Math.min(fontSize, bannerHeight * 0.5));

  const svg = `
    <svg width="${width}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${bannerHeight}" fill="${hexToRgba(bgColorHex, 0.8)}" />
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, 'Liberation Sans', sans-serif" font-size="${fontSize.toFixed(1)}"
        font-weight="bold" fill="#FFFFFF">${escapeXml(text)}</text>
    </svg>`;

  return Buffer.from(svg);
}

function buildOccasionBadgeSvg(badgeColorHex: string, occasionText: string): Buffer {
  const text = occasionText.trim();
  const targetTextWidth = BADGE_WIDTH * 0.82;
  let fontSize = targetTextWidth / Math.max(1, text.length * 0.56);
  fontSize = Math.max(11, Math.min(fontSize, BADGE_HEIGHT * 0.55));

  const svg = `
    <svg width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="${BADGE_RADIUS}" ry="${BADGE_RADIUS}" fill="${badgeColorHex}" />
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, 'Liberation Sans', sans-serif" font-size="${fontSize.toFixed(1)}"
        font-weight="bold" fill="#FFFFFF">${escapeXml(text)}</text>
    </svg>`;

  return Buffer.from(svg);
}

// ─── Cloudinary upload ──────────────────────────────────────────────────────────

async function uploadBufferToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (err, result) => {
      if (err) return reject(new Error(`Cloudinary: ${err.message}`));
      if (!result) return reject(new Error("Cloudinary returned no result"));
      resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}

// ─── generatePromoCreative ───────────────────────────────────────────────────────
// Public entry point: Ideogram v3 background -> logo + CTA banner + occasion badge
// composited via Sharp -> Cloudinary -> GeneratedImage row -> credit deduction.

export async function generatePromoCreative(
  userId: string,
  brandId: string,
  brief: string,
  ctaText: string,
  occasion?: string
): Promise<{ imageId: string; imageUrl: string }> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand || brand.userId !== userId) throw createError("Brand not found", 404);

  const visualMood = brand.brandDna ? (JSON.parse(brand.brandDna) as BrandDNA).visual_mood : "clean, modern, warm";
  const { prompt } = buildIdeogramPrompt(brief, brand.industry, visualMood);

  const startedAt = Date.now();
  console.log(`[promoCreative] START | ${new Date().toISOString()}`);

  const backgroundBuffer = await generateBackgroundBuffer(prompt);
  console.log(`[promoCreative] Ideogram done | elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  let primaryColor = brand.logoColorPrimary ?? undefined;
  let secondaryColor = brand.logoColorSecondary ?? undefined;
  let logoLayer: LogoLayer | undefined;

  if (brand.logoUrl) {
    const logoBuffer = await fetchBufferFromUrl(brand.logoUrl);
    logoLayer = await buildLogoWithShadow(logoBuffer, CANVAS_WIDTH);

    if (!primaryColor || !secondaryColor) {
      const extracted = await extractDominantColors(logoBuffer);
      primaryColor = extracted.primary;
      secondaryColor = extracted.secondary;
      // Cache on the brand so future promo generations skip extraction entirely.
      await prisma.brand
        .update({ where: { id: brand.id }, data: { logoColorPrimary: primaryColor, logoColorSecondary: secondaryColor } })
        .catch(() => {});
    }
  }

  primaryColor = primaryColor ?? DEFAULT_PRIMARY_COLOR;
  secondaryColor = secondaryColor ?? DEFAULT_SECONDARY_COLOR;

  const composites: OverlayOptions[] = [
    { input: buildCtaBannerSvg(CANVAS_WIDTH, BANNER_HEIGHT, primaryColor, ctaText), left: 0, top: CANVAS_HEIGHT - BANNER_HEIGHT },
  ];

  if (logoLayer) {
    // Anchor to banner top, not canvas bottom, so logo never overlaps the CTA text.
    // Logo bottom edge sits LOGO_BANNER_GAP pixels above the banner's top edge.
    const logoPaddedTop =
      CANVAS_HEIGHT - BANNER_HEIGHT - LOGO_BANNER_GAP - logoLayer.logoHeight - logoLayer.pad;
    composites.push({
      input: logoLayer.buffer,
      left: LOGO_MARGIN - logoLayer.pad,
      top: logoPaddedTop,
    });
  }

  if (occasion) {
    composites.push({
      input: buildOccasionBadgeSvg(secondaryColor, occasion),
      left: CANVAS_WIDTH - BADGE_MARGIN - BADGE_WIDTH,
      top: BADGE_MARGIN,
    });
  }

  const finalBuffer = await sharp(backgroundBuffer)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: "cover" })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toBuffer();

  const imageUrl = await uploadBufferToCloudinary(finalBuffer, "brandefai/promo");
  console.log(`[promoCreative] Done | total elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s | ${imageUrl}`);

  const record = await prisma.generatedImage.create({
    data: {
      userId,
      brandId,
      originalPrompt: brief,
      enhancedPrompt: prompt,
      imageUrl,
      style: "promo",
      format: "4:5",
      source: ImageSource.GENERATED,
    },
  });

  await deductCredits(prisma, userId, 5, CreditType.GENERATION, record.id);

  return { imageId: record.id, imageUrl };
}
