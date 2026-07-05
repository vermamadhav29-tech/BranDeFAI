import Replicate from "replicate";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import prisma from "../utils/prisma";
import { generateText } from "./ai/openaiService";
import { getBrandContext } from "./brandDNA.service";
import { generateCaptionSet, pickBestCaption } from "./contentService";
import { generateFluxBackground } from "./fluxImage.service";
import { extractDominantColors } from "./promoCreative.service";
import type { BrandDNA } from "./brandDNA.service";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const DEFAULT_PRIMARY = "#1A7A4A";
const DEFAULT_SECONDARY = "#1A2E44";

// ─── Indian Occasions Calendar 2026 ──────────────────────────────────────────

interface Occasion {
  name: string;
  emoji: string;
  date: Date;
  themes: string;
  hook: string;
}

const OCCASIONS_2026: Occasion[] = [
  {
    name: "Muharram",
    emoji: "🌙",
    date: new Date("2026-07-07"),
    themes: "reflection, peace, community",
    hook: "Peace and blessings to all",
  },
  {
    name: "Friendship Day",
    emoji: "🤝",
    date: new Date("2026-08-02"),
    themes: "bonds, celebration, togetherness",
    hook: "Celebrate the friends who make life better",
  },
  {
    name: "Independence Day",
    emoji: "🇮🇳",
    date: new Date("2026-08-15"),
    themes: "patriotism, pride, India, tricolour",
    hook: "Proud to be Indian",
  },
  {
    name: "Janmashtami",
    emoji: "🦚",
    date: new Date("2026-08-16"),
    themes: "devotion, joy, celebration, Krishna",
    hook: "Celebrate the birth of Lord Krishna",
  },
  {
    name: "Ganesh Chaturthi",
    emoji: "🐘",
    date: new Date("2026-09-02"),
    themes: "new beginnings, prosperity, festivity",
    hook: "May Ganeshji bless you with success",
  },
  {
    name: "Navratri",
    emoji: "💃",
    date: new Date("2026-09-24"),
    themes: "dance, colours, celebration, Durga, power",
    hook: "Nine nights of joy and Shakti",
  },
  {
    name: "Dussehra",
    emoji: "🏹",
    date: new Date("2026-10-02"),
    themes: "victory of good, new beginnings, celebration",
    hook: "Victory of good over evil",
  },
  {
    name: "Dhanteras",
    emoji: "🪔",
    date: new Date("2026-10-17"),
    themes: "wealth, prosperity, shopping, gold, silver",
    hook: "Bring home prosperity this Dhanteras",
  },
  {
    name: "Diwali",
    emoji: "🪔",
    date: new Date("2026-10-19"),
    themes: "lights, joy, prosperity, gifts, celebration, family",
    hook: "Light up your life this Diwali",
  },
  {
    name: "Bhai Dooj",
    emoji: "🫂",
    date: new Date("2026-10-21"),
    themes: "sibling love, protection, celebration",
    hook: "Celebrate the bond between brothers and sisters",
  },
  {
    name: "Guru Nanak Jayanti",
    emoji: "🙏",
    date: new Date("2026-11-05"),
    themes: "devotion, peace, community, gratitude",
    hook: "Waheguru's blessings to all",
  },
  {
    name: "Christmas",
    emoji: "🎄",
    date: new Date("2026-12-25"),
    themes: "joy, gifts, family, celebration, warmth",
    hook: "Spread joy and love this Christmas",
  },
  {
    name: "New Year",
    emoji: "🎆",
    date: new Date("2026-12-31"),
    themes: "new beginnings, celebration, hope, goals",
    hook: "Here's to a brilliant new year",
  },
];

export interface OccasionContext {
  name: string;
  emoji: string;
  themes: string;
  hook: string;
  days_away: number;
}

export function getUpcomingOccasions(withinDays = 14): OccasionContext[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  return OCCASIONS_2026.filter((o) => o.date >= now && o.date <= cutoff).map((o) => ({
    name: o.name,
    emoji: o.emoji,
    themes: o.themes,
    hook: o.hook,
    days_away: Math.ceil((o.date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  }));
}

// ─── Creative Brief ───────────────────────────────────────────────────────────

interface CreativeBrief {
  headline: string;
  subheadline: string;
  cta: string;
  background_scene: string;
  background_mood: string;
  product_placement: "left" | "right" | "center" | "bottom-right";
  layout: "product-hero" | "lifestyle-blend" | "minimal-product";
  feature_badges: string[];
  tagline: string;
  occasion_badge: string | null;
}

const CREATIVE_BRIEF_SYSTEM = `You are a creative director for Indian brands. Based on the brand DNA and occasion context, create a complete creative brief for a promotional Instagram post. The post must feature the actual product photo — do not replace or reimagine the product.

Return ONLY valid JSON matching this exact shape:
{
  "headline": "punchy max 4 words, can be Hinglish",
  "subheadline": "supporting line max 8 words",
  "cta": "call to action max 3 words e.g. Shop Now",
  "background_scene": "detailed description of AI-generated background scene to composite behind the product — emotional, occasion-appropriate, photorealistic cinematic",
  "background_mood": "color palette and lighting description e.g. warm golden tones, bokeh lights, dark elegant background",
  "product_placement": "right",
  "layout": "product-hero",
  "feature_badges": ["Premium Quality", "Handcrafted", "Fast Delivery"],
  "tagline": "brand tagline for bottom bar",
  "occasion_badge": "Happy Diwali 🪔 or null if no occasion"
}`;

async function generateCreativeBrief(
  brandContext: string,
  industryLabel: string,
  whatTheySell: string,
  occasion: OccasionContext | null
): Promise<CreativeBrief> {
  const user = [
    `BRAND CONTEXT:\n${brandContext}`,
    ``,
    `OCCASION: ${occasion ? `${occasion.name} ${occasion.emoji} (in ${occasion.days_away} days)` : "None — general brand post"}`,
    occasion ? `OCCASION THEMES: ${occasion.themes}` : "",
    occasion ? `OCCASION HOOK: ${occasion.hook}` : "",
    ``,
    `PRODUCT/SERVICE: ${whatTheySell || industryLabel}`,
    `INDUSTRY: ${industryLabel}`,
    ``,
    `Create a creative brief for a promotional Instagram post (1080x1350 portrait).`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const result = await generateText(CREATIVE_BRIEF_SYSTEM, user, true, 600);
  return result as CreativeBrief;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Failed to download (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Gradient overlay SVG ────────────────────────────────────────────────────

function buildGradientSvg(placement: CreativeBrief["product_placement"]): Buffer {
  let gradientDef: string;

  if (placement === "right") {
    gradientDef = `<linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="black" stop-opacity="0.72"/>
      <stop offset="55%" stop-color="black" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </linearGradient>`;
  } else if (placement === "left") {
    gradientDef = `<linearGradient id="grad" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="black" stop-opacity="0.72"/>
      <stop offset="55%" stop-color="black" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </linearGradient>`;
  } else {
    // center / bottom-right: radial vignette
    gradientDef = `<radialGradient id="grad" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.55"/>
    </radialGradient>`;
  }

  const svg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>${gradientDef}</defs>
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#grad)"/>
  </svg>`;
  return Buffer.from(svg);
}

// ─── Text + UI overlay SVG ────────────────────────────────────────────────────

function buildTextOverlaySvg(
  brief: CreativeBrief,
  primaryColor: string,
  secondaryColor: string,
  logoDataUri: string | null
): Buffer {
  const { placement } = { placement: brief.product_placement };
  const isRightProduct = placement === "right";
  const textX = isRightProduct ? 48 : CANVAS_W / 2 + 48;
  const textMaxW = CANVAS_W / 2 - 80;

  // Split headline into max 2 lines (first word / rest)
  const words = brief.headline.trim().split(/\s+/);
  const headLine1 = words[0] ?? "";
  const headLine2 = words.slice(1).join(" ");

  // Headline Y positions
  const HL_Y1 = Math.round(CANVAS_H * 0.35);
  const HL_Y2 = HL_Y1 + 76;
  const SUB_Y = HL_Y2 + (headLine2 ? 72 : 20);

  // Feature badges
  const badges = (brief.feature_badges ?? []).slice(0, 4);
  const BADGE_Y = Math.round(CANVAS_H * 0.62);
  const BADGE_H = 30;
  const BADGE_R = 15;
  const BADGE_GAP = 10;
  const BADGE_PX = 14;
  const BADGE_FONT = 12;

  // Bottom bar
  const BAR_Y = CANVAS_H - 90;
  const BAR_H = 90;
  const CTA_W = 160;
  const CTA_H = 52;
  const CTA_X = CANVAS_W - CTA_W - 30;
  const CTA_Y = BAR_Y + (BAR_H - CTA_H) / 2;

  // Occasion badge (top-right)
  const BADGE_OCC_X = isRightProduct ? 30 : 0;
  const BADGE_OCC_W = 220;

  const elements: string[] = [];

  // Occasion badge
  if (brief.occasion_badge) {
    const occ = escapeXml(brief.occasion_badge);
    const occX = isRightProduct ? CANVAS_W - BADGE_OCC_W - 30 : 30;
    elements.push(`
      <rect x="${occX}" y="30" width="${BADGE_OCC_W}" height="44" rx="22" ry="22" fill="${primaryColor}" opacity="0.92"/>
      <text x="${occX + BADGE_OCC_W / 2}" y="58" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white">${occ}</text>
    `);
  }

  // Brand logo (top-left or top-right depending on text side)
  const LOGO_W = 180;
  const LOGO_H = 80;
  const logoX = isRightProduct ? 30 : CANVAS_W - LOGO_W - 30;
  const logoY = 36;
  if (logoDataUri) {
    elements.push(`
      <image href="${logoDataUri}" x="${logoX}" y="${logoY}" width="${LOGO_W}" height="${LOGO_H}"
        preserveAspectRatio="xMinYMid meet" opacity="0.95"/>
    `);
  }

  // Headline
  if (headLine1) {
    elements.push(`
      <text x="${textX}" y="${HL_Y1}"
        font-family="Arial, 'Liberation Sans', sans-serif" font-size="64" font-weight="bold"
        fill="white" dominant-baseline="auto">${escapeXml(headLine1)}</text>
    `);
  }
  if (headLine2) {
    elements.push(`
      <text x="${textX}" y="${HL_Y2}"
        font-family="Arial, 'Liberation Sans', sans-serif" font-size="64" font-weight="bold"
        fill="${primaryColor}" dominant-baseline="auto">${escapeXml(headLine2)}</text>
    `);
  }

  // Subheadline
  if (brief.subheadline) {
    elements.push(`
      <text x="${textX}" y="${SUB_Y}"
        font-family="Arial, 'Liberation Sans', sans-serif" font-size="22"
        fill="rgba(255,255,255,0.82)" dominant-baseline="auto">${escapeXml(brief.subheadline)}</text>
    `);
  }

  // Feature badges
  let badgeCurX = textX;
  const badgeElems: string[] = [];
  badges.forEach((badge) => {
    const text = escapeXml(badge);
    const approxW = Math.max(80, text.length * BADGE_FONT * 0.54 + BADGE_PX * 2);
    if (badgeCurX + approxW > textX + textMaxW) return; // skip if overflow
    badgeElems.push(`
      <rect x="${badgeCurX}" y="${BADGE_Y}" width="${approxW}" height="${BADGE_H}" rx="${BADGE_R}" ry="${BADGE_R}"
        fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>
      <text x="${badgeCurX + approxW / 2}" y="${BADGE_Y + BADGE_H / 2 + 1}"
        text-anchor="middle" dominant-baseline="central"
        font-family="Arial, sans-serif" font-size="${BADGE_FONT}" fill="white">${text}</text>
    `);
    badgeCurX += approxW + BADGE_GAP;
  });
  elements.push(...badgeElems);

  // Bottom bar
  elements.push(`
    <rect x="0" y="${BAR_Y}" width="${CANVAS_W}" height="${BAR_H}" fill="${hexToRgba(primaryColor, 0.88)}"/>
  `);
  if (brief.tagline) {
    elements.push(`
      <text x="30" y="${BAR_Y + BAR_H / 2 + 1}" dominant-baseline="central"
        font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.82)">${escapeXml(brief.tagline)}</text>
    `);
  }
  // CTA button
  if (brief.cta) {
    elements.push(`
      <rect x="${CTA_X}" y="${CTA_Y}" width="${CTA_W}" height="${CTA_H}" rx="${CTA_H / 2}" ry="${CTA_H / 2}" fill="white"/>
      <text x="${CTA_X + CTA_W / 2}" y="${CTA_Y + CTA_H / 2 + 1}" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${primaryColor}">${escapeXml(brief.cta)}</text>
    `);
  }

  const svg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${elements.join("\n")}
  </svg>`;

  return Buffer.from(svg);
}

// ─── Sharp compositing ────────────────────────────────────────────────────────

async function compositeCreativeImage(opts: {
  backgroundBuffer: Buffer;
  productBuffer: Buffer;
  logoDataUri: string | null;
  brief: CreativeBrief;
  primaryColor: string;
  secondaryColor: string;
}): Promise<Buffer> {
  const { backgroundBuffer, productBuffer, logoDataUri, brief, primaryColor, secondaryColor } = opts;

  // ── Resize background to exact canvas size ──
  const bg = await sharp(backgroundBuffer)
    .resize(CANVAS_W, CANVAS_H, { fit: "cover", position: "center" })
    .toBuffer();

  // ── Resize product: 45% canvas width, preserve aspect ratio ──
  const PRODUCT_TARGET_W = Math.round(CANVAS_W * 0.45);
  const productResized = await sharp(productBuffer)
    .resize({ width: PRODUCT_TARGET_W })
    .toBuffer();
  const productMeta = await sharp(productResized).metadata();
  const productW = productMeta.width ?? PRODUCT_TARGET_W;
  const productH = productMeta.height ?? PRODUCT_TARGET_W;

  // ── Product placement coordinates ──
  const placement = brief.product_placement;
  let productLeft: number;
  let productTop: number;
  const VERT_PAD = 40;
  const centeredTop = Math.round((CANVAS_H - productH) / 2) + VERT_PAD;

  if (placement === "right") {
    productLeft = Math.round(CANVAS_W * 0.52);
    productTop = centeredTop;
  } else if (placement === "left") {
    productLeft = Math.round(CANVAS_W * 0.03);
    productTop = centeredTop;
  } else if (placement === "bottom-right") {
    productLeft = Math.round(CANVAS_W * 0.5);
    productTop = Math.round(CANVAS_H * 0.35);
  } else {
    // center
    productLeft = Math.round((CANVAS_W - productW) / 2);
    productTop = centeredTop;
  }

  // Keep product within canvas bounds
  productLeft = Math.max(0, Math.min(productLeft, CANVAS_W - productW));
  productTop = Math.max(0, Math.min(productTop, CANVAS_H - productH - 90));

  // ── Drop shadow for product ──
  const shadowPad = 20;
  const shadowBlur = 20;
  const canvasWS = productW + shadowPad * 2;
  const canvasHS = productH + shadowPad * 2;
  const shadowLayer = await sharp(productResized)
    .ensureAlpha()
    .tint({ r: 0, g: 0, b: 0 })
    .blur(shadowBlur)
    .toBuffer();

  const productWithShadow = await sharp({
    create: { width: canvasWS, height: canvasHS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: shadowLayer, left: shadowPad + 4, top: shadowPad + 8, blend: "multiply" },
      { input: productResized, left: shadowPad, top: shadowPad },
    ])
    .png()
    .toBuffer();

  // ── Build compositing layers ──
  const composites: OverlayOptions[] = [
    // Gradient overlay
    { input: buildGradientSvg(placement), left: 0, top: 0 },
    // Product with shadow
    {
      input: productWithShadow,
      left: Math.max(0, productLeft - shadowPad),
      top: Math.max(0, productTop - shadowPad),
    },
    // Text + UI overlay
    {
      input: buildTextOverlaySvg(brief, primaryColor, secondaryColor, logoDataUri),
      left: 0,
      top: 0,
    },
  ];

  return sharp(bg)
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ─── Cloudinary upload ────────────────────────────────────────────────────────

async function uploadToCloudinary(buffer: Buffer, brandId: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `brandefai/auto-creative/${brandId}`, resource_type: "image" },
      (err, result) => {
        if (err) return reject(new Error(`Cloudinary: ${err.message}`));
        if (!result) return reject(new Error("Cloudinary returned no result"));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// ─── generateAutoCreative ─────────────────────────────────────────────────────
// Main entry point. Returns null if brand has no product images (nothing to do).

export async function generateAutoCreative(
  brandId: string,
  userId: string,
  trigger: "occasion" | "new_product" | "manual" | "scheduled" = "manual",
  specificProductImageId?: string
): Promise<{ postId: string; imageUrl: string; caption: string } | null> {
  const startedAt = Date.now();
  console.log(`[autoCreative] START brand=${brandId} trigger=${trigger}`);

  try {
    // ── Step 1: Gather context ──
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand || brand.userId !== userId) {
      console.log(`[autoCreative] Brand not found or unauthorized`);
      return null;
    }
    if (!brand.brandDna) {
      console.log(`[autoCreative] Brand DNA not ready yet, skipping`);
      return null;
    }

    const productImage = specificProductImageId
      ? await prisma.productImage.findUnique({ where: { id: specificProductImageId } })
      : await prisma.productImage.findFirst({
          where: { brandId },
          orderBy: { uploadedAt: "desc" },
        });

    if (!productImage) {
      console.log(`[autoCreative] No product images found`);
      return null;
    }

    const brandContext = await getBrandContext(brandId).catch(() => "");

    // ── Step 2: Detect occasion ──
    const occasions = getUpcomingOccasions(14);
    const occasion = occasions[0] ?? null;

    // ── Step 3: Generate creative brief ──
    const brief = await generateCreativeBrief(
      brandContext,
      brand.industry,
      brand.whatTheySell ?? brand.brandBrief ?? brand.industry,
      occasion
    );
    console.log(`[autoCreative] Brief generated | headline="${brief.headline}"`);

    // ── Step 4: Generate background via Flux 2 Pro ──
    const fluxPrompt = [
      brief.background_scene,
      brief.background_mood,
      "professional commercial photography, cinematic lighting, photorealistic, high resolution",
      "shot on Sony A7R V, 85mm f/1.4, shallow depth of field",
      "no text, no logos, no watermarks, no people unless described",
    ].join(", ");

    const backgroundBuffer = await generateFluxBackground(fluxPrompt);
    console.log(`[autoCreative] Background generated | elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

    // ── Step 5: Composite final image ──
    const productBuffer = await fetchBuffer(productImage.imageUrl);

    let primaryColor = brand.logoColorPrimary ?? DEFAULT_PRIMARY;
    let secondaryColor = brand.logoColorSecondary ?? DEFAULT_SECONDARY;
    let logoDataUri: string | null = null;

    if (brand.logoUrl) {
      const logoBuffer = await fetchBuffer(brand.logoUrl).catch(() => null);
      if (logoBuffer) {
        if (!brand.logoColorPrimary || !brand.logoColorSecondary) {
          const { primary, secondary } = await extractDominantColors(logoBuffer).catch(() => ({
            primary: DEFAULT_PRIMARY,
            secondary: DEFAULT_SECONDARY,
          }));
          primaryColor = primary;
          secondaryColor = secondary;
          // Cache for future calls
          await prisma.brand
            .update({ where: { id: brandId }, data: { logoColorPrimary: primaryColor, logoColorSecondary: secondaryColor } })
            .catch(() => {});
        }
        // Convert logo to base64 data URI for SVG embedding
        const pngBuf = await sharp(logoBuffer).png().toBuffer();
        logoDataUri = `data:image/png;base64,${pngBuf.toString("base64")}`;
      }
    }

    const finalBuffer = await compositeCreativeImage({
      backgroundBuffer,
      productBuffer,
      logoDataUri,
      brief,
      primaryColor,
      secondaryColor,
    });
    console.log(`[autoCreative] Composited | elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

    // ── Upload to Cloudinary ──
    const imageUrl = await uploadToCloudinary(finalBuffer, brandId);
    console.log(`[autoCreative] Uploaded | ${imageUrl}`);

    // ── Step 6: Generate caption ──
    const dna = JSON.parse(brand.brandDna) as BrandDNA;
    const brandDnaBlock = brandContext;
    const campaignBrief = occasion
      ? `${occasion.name} promotional post for ${brand.brandName}. ${occasion.hook}. Product: ${brand.whatTheySell ?? brand.industry}.`
      : `Brand awareness post for ${brand.brandName}. ${brief.subheadline}. Product: ${brand.whatTheySell ?? brand.industry}.`;

    const { captions } = await generateCaptionSet(brandDnaBlock, campaignBrief, "promotional").catch(
      () => ({ captions: [], seo_keywords: [] })
    );

    const bestCaption = captions.length > 0 ? pickBestCaption(captions).selected : null;
    const captionText = bestCaption?.full_caption ?? `${brief.headline} — ${brief.subheadline}`;
    const hashtags = bestCaption?.hashtags ?? [];

    // ── Step 7: Save to database ──
    const post = await prisma.generatedPost.create({
      data: {
        brandId,
        userId,
        imageUrl,
        caption: captionText,
        hashtags,
        occasionName: occasion?.name ?? null,
        occasionEmoji: occasion?.emoji ?? null,
        productImageId: productImage.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        creativeData: JSON.parse(JSON.stringify(brief)) as any,
        trigger,
        status: "PENDING_APPROVAL",
      },
    });

    console.log(
      `[autoCreative] DONE | postId=${post.id} elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`
    );

    return { postId: post.id, imageUrl, caption: captionText };
  } catch (err) {
    console.error(`[autoCreative] ERROR | brand=${brandId}`, err);
    return null;
  }
}
