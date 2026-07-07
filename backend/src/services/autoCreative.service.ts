import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import prisma from "../utils/prisma";
import { getBrandContext } from "./brandDNA.service";
import { generateCaptionSet, pickBestCaption } from "./contentService";
import { generateFluxBackground } from "./fluxImage.service";
import { generateCreativeBrief, CreativeBrief } from "./creativeBrief.service";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CANVAS_W = 1080;
const CANVAS_H = 1350;

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

// ─── White background removal ─────────────────────────────────────────────────
// Walks every pixel; sets alpha to 0 for near-white (all channels > threshold).
// Only called when sharp().stats() confirms the image is predominantly white.

async function removeWhiteBackground(imageBuffer: Buffer, threshold = 230): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > threshold && pixels[i + 1] > threshold && pixels[i + 2] > threshold) {
      pixels[i + 3] = 0;
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

// ─── Gradient overlay SVG ────────────────────────────────────────────────────
// Opacity 0.55 — visible enough for text legibility, not so heavy it hides background.

function buildGradientSvg(
  layoutStyle: CreativeBrief["layout_style"],
  placement: CreativeBrief["product_placement"]
): Buffer {
  let gradientDef: string;

  if (layoutStyle === "split" && placement === "right") {
    // Product on right → dark gradient from left 60% of canvas
    gradientDef = `<linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="black" stop-opacity="0.72"/>
      <stop offset="60%"  stop-color="black" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </linearGradient>`;
  } else if (layoutStyle === "split" && placement === "left") {
    // Product on left → dark gradient from right 60% of canvas
    gradientDef = `<linearGradient id="grad" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0%"   stop-color="black" stop-opacity="0.72"/>
      <stop offset="60%"  stop-color="black" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </linearGradient>`;
  } else if (layoutStyle === "overlay") {
    // Radial vignette around all edges
    gradientDef = `<radialGradient id="grad" cx="50%" cy="50%" r="70%">
      <stop offset="0%"   stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.55"/>
    </radialGradient>`;
  } else {
    // minimal / full-bleed: light overlay on bottom 30% only
    gradientDef = `<linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="70%"  stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.40"/>
    </linearGradient>`;
  }

  const svg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>${gradientDef}</defs>
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#grad)"/>
  </svg>`;
  return Buffer.from(svg);
}

// ─── Text + UI overlay SVG ────────────────────────────────────────────────────

function buildTextOverlaySvg(brief: CreativeBrief, logoDataUri: string | null): Buffer {
  const placement = brief.product_placement;
  const primary = brief.primary_color;
  const accent = brief.accent_color;

  // Text column: left half for product-right layouts, right half for product-left
  const isProductRight = placement === "right";
  const isProductLeft = placement === "left";
  const textX = isProductLeft ? Math.round(CANVAS_W / 2) + 40 : 40;
  const textMaxW = Math.round(CANVAS_W / 2) - 80;

  // Headline Y positions (spec: y=380, line height 80px)
  const HL_Y1 = 380;
  const HL_Y2 = HL_Y1 + 80;
  const SUB_Y = 560;

  // Feature badges
  const badges = (brief.feature_badges ?? []).slice(0, 3);
  const BADGE_Y = 650;
  const BADGE_H = 32;
  const BADGE_R = 14;
  const BADGE_GAP = 12;
  const BADGE_PX = 14;
  const BADGE_FONT = 13;

  // Bottom bar (spec: y=1260, height=90)
  const BAR_Y = 1260;
  const BAR_H = 90;
  const CTA_W = 200;
  const CTA_H = 52;
  const CTA_X = 830;
  const CTA_Y = BAR_Y + (BAR_H - CTA_H) / 2; // vertically centered in bar

  // Occasion badge (top-right, spec: x=820, y=40)
  const BADGE_OCC_W = 220;
  const BADGE_OCC_H = 44;
  const BADGE_OCC_X = isProductRight ? CANVAS_W - BADGE_OCC_W - 30 : 30;

  // Logo (top of text column)
  const LOGO_W = 216; // 20% of 1080
  const LOGO_H = 80;
  const logoX = isProductLeft ? CANVAS_W - LOGO_W - 30 : 30;

  const elements: string[] = [];

  // ── Occasion badge (top-right) ──
  if (brief.occasion_badge) {
    const occ = escapeXml(brief.occasion_badge);
    elements.push(`
      <rect x="${BADGE_OCC_X}" y="40" width="${BADGE_OCC_W}" height="${BADGE_OCC_H}" rx="22" ry="22"
        fill="${primary}" opacity="0.92"/>
      <text x="${BADGE_OCC_X + BADGE_OCC_W / 2}" y="${40 + BADGE_OCC_H / 2 + 1}"
        text-anchor="middle" dominant-baseline="central"
        font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif"
        font-size="14" font-weight="bold" fill="white">${occ}</text>
    `);
  }

  // ── Brand logo (top of text column) ──
  if (logoDataUri) {
    elements.push(`
      <image href="${logoDataUri}" x="${logoX}" y="50" width="${LOGO_W}" height="${LOGO_H}"
        preserveAspectRatio="xMinYMid meet" opacity="0.95"/>
    `);
  }

  // ── Headline line 1: brief.headline (white) ──
  if (brief.headline) {
    elements.push(`
      <text x="${textX}" y="${HL_Y1}"
        font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif"
        font-size="68" font-weight="bold" fill="white" dominant-baseline="auto">${escapeXml(brief.headline)}</text>
    `);
  }

  // ── Headline line 2: brief.headline_accent (accent color) ──
  if (brief.headline_accent) {
    elements.push(`
      <text x="${textX}" y="${HL_Y2}"
        font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif"
        font-size="68" font-weight="bold" fill="${accent}" dominant-baseline="auto">${escapeXml(brief.headline_accent)}</text>
    `);
  }

  // ── Subheadline ──
  if (brief.subheadline) {
    elements.push(`
      <text x="${textX}" y="${SUB_Y}"
        font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif"
        font-size="22" fill="rgba(255,255,255,0.85)" dominant-baseline="auto">${escapeXml(brief.subheadline)}</text>
    `);
  }

  // ── Divider line ──
  elements.push(`
    <rect x="${textX}" y="600" width="160" height="2" fill="${accent}"/>
  `);

  // ── Feature badges (horizontal row, y=650) ──
  let badgeCurX = textX;
  badges.forEach((badge) => {
    const text = escapeXml(badge);
    const approxW = Math.max(80, text.length * BADGE_FONT * 0.54 + BADGE_PX * 2 + 18);
    if (badgeCurX + approxW > textX + textMaxW) return;
    elements.push(`
      <rect x="${badgeCurX}" y="${BADGE_Y}" width="${approxW}" height="${BADGE_H}" rx="${BADGE_R}" ry="${BADGE_R}"
        fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>
      <circle cx="${badgeCurX + 14}" cy="${BADGE_Y + BADGE_H / 2}" r="4" fill="${accent}"/>
      <text x="${badgeCurX + 26}" y="${BADGE_Y + BADGE_H / 2 + 1}"
        dominant-baseline="central"
        font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif"
        font-size="${BADGE_FONT}" fill="rgba(255,255,255,0.90)">${text}</text>
    `);
    badgeCurX += approxW + BADGE_GAP;
  });

  // ── Bottom bar ──
  elements.push(`
    <rect x="0" y="${BAR_Y}" width="${CANVAS_W}" height="${BAR_H}" fill="${hexToRgba(primary, 0.90)}"/>
  `);

  if (brief.tagline) {
    elements.push(`
      <text x="30" y="${BAR_Y + BAR_H / 2 + 1}" dominant-baseline="central"
        font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif"
        font-size="14" fill="rgba(255,255,255,0.82)">${escapeXml(brief.tagline)}</text>
    `);
  }

  // ── CTA button ──
  if (brief.cta) {
    elements.push(`
      <rect x="${CTA_X}" y="${CTA_Y}" width="${CTA_W}" height="${CTA_H}" rx="22" ry="22" fill="white"/>
      <text x="${CTA_X + CTA_W / 2}" y="${CTA_Y + CTA_H / 2 + 1}"
        text-anchor="middle" dominant-baseline="central"
        font-family="'Liberation Sans', 'DejaVu Sans', Arial, sans-serif"
        font-size="15" font-weight="bold" fill="${primary}">${escapeXml(brief.cta)}</text>
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
}): Promise<Buffer> {
  const { backgroundBuffer, productBuffer, logoDataUri, brief } = opts;

  // ── Resize background to exact canvas ──
  const bg = await sharp(backgroundBuffer)
    .resize(CANVAS_W, CANVAS_H, { fit: "cover", position: "center" })
    .toBuffer();

  // ── Product width by brief.product_size ──
  const sizeMap: Record<CreativeBrief["product_size"], number> = {
    large: Math.round(CANVAS_W * 0.55),
    medium: Math.round(CANVAS_W * 0.42),
    small: Math.round(CANVAS_W * 0.30),
  };
  const PRODUCT_TARGET_W = sizeMap[brief.product_size] ?? Math.round(CANVAS_W * 0.42);

  // ── White background detection + removal ──
  const stats = await sharp(productBuffer).stats();
  const rMean = stats.channels[0].mean;
  const gMean = stats.channels[1].mean;
  const bMean = stats.channels[2].mean;
  const hasWhiteBg = rMean > 230 && gMean > 230 && bMean > 230;

  const cleanProduct = hasWhiteBg ? await removeWhiteBackground(productBuffer) : productBuffer;

  // ── Resize product, preserve aspect ratio ──
  const productResized = await sharp(cleanProduct)
    .resize({ width: PRODUCT_TARGET_W })
    .toBuffer();
  const productMeta = await sharp(productResized).metadata();
  const productW = productMeta.width ?? PRODUCT_TARGET_W;
  const productH = productMeta.height ?? PRODUCT_TARGET_W;

  // ── Product placement coordinates (spec) ──
  const placement = brief.product_placement;
  let productLeft: number;
  let productTop: number;

  if (placement === "right") {
    productLeft = Math.round(CANVAS_W * 0.50);
    productTop = Math.round(CANVAS_H * 0.18);
  } else if (placement === "left") {
    productLeft = Math.round(CANVAS_W * 0.03);
    productTop = Math.round(CANVAS_H * 0.25);
  } else if (placement === "bottom-center") {
    productLeft = Math.round((CANVAS_W - productW) / 2);
    productTop = Math.round(CANVAS_H * 0.50);
  } else {
    // center
    productLeft = Math.round((CANVAS_W - productW) / 2);
    productTop = Math.round(CANVAS_H * 0.30);
  }

  // Clamp to canvas — leave room for bottom bar (90px)
  productLeft = Math.max(0, Math.min(productLeft, CANVAS_W - productW));
  productTop = Math.max(0, Math.min(productTop, CANVAS_H - productH - 90));

  // ── Drop shadow (blur 25px, opacity 35%) ──
  const shadowPad = 25;
  const canvasWS = productW + shadowPad * 2;
  const canvasHS = productH + shadowPad * 2;

  const shadowLayer = await sharp(productResized)
    .ensureAlpha()
    .tint({ r: 0, g: 0, b: 0 })
    .blur(25)
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

  // ── Composite: background → gradient → product → SVG text ──
  const composites: OverlayOptions[] = [
    { input: buildGradientSvg(brief.layout_style, placement), left: 0, top: 0 },
    {
      input: productWithShadow,
      left: Math.max(0, productLeft - shadowPad),
      top: Math.max(0, productTop - shadowPad),
    },
    { input: buildTextOverlaySvg(brief, logoDataUri), left: 0, top: 0 },
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
      { folder: `brandefai/product-posts/${brandId}`, resource_type: "image" },
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

export async function generateAutoCreative(
  brandId: string,
  userId: string,
  trigger: "occasion" | "new_product" | "manual" | "scheduled" = "manual",
  specificProductImageId?: string
): Promise<{ postId: string; imageUrl: string; caption: string } | null> {
  const startedAt = Date.now();
  console.log(`[autoCreative] START brand=${brandId} trigger=${trigger}`);

  try {
    // ── Step 1: Gather brand + product ──
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

    // ── Step 2: Detect occasion ──
    const occasions = getUpcomingOccasions(14);
    const occasion = occasions[0] ?? null;

    // ── Step 3: Generate creative brief ──
    const brief = await generateCreativeBrief({
      brandId,
      productImageUrl: productImage.imageUrl,
      productDescription: brand.whatTheySell ?? brand.brandBrief ?? brand.industry,
      ideaTitle: occasion
        ? `${occasion.name} promotional post`
        : `${brand.brandName} brand awareness post`,
      ideaType: occasion ? "seasonal" : "promotional",
      occasionName: occasion?.name,
    });
    console.log(
      `[autoCreative] Brief | headline="${brief.headline}" layout=${brief.layout_style} placement=${brief.product_placement}`
    );

    // ── Step 4: Generate background via Flux 2 Pro using brief.flux_prompt ──
    const backgroundBuffer = await generateFluxBackground(brief.flux_prompt, brief.flux_negative);
    console.log(`[autoCreative] Background | elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

    // ── Step 5: Fetch product image ──
    const productBuffer = await fetchBuffer(productImage.imageUrl);

    // ── Step 6: Fetch logo (for SVG overlay) ──
    let logoDataUri: string | null = null;
    if (brand.logoUrl) {
      const logoBuffer = await fetchBuffer(brand.logoUrl).catch(() => null);
      if (logoBuffer) {
        const pngBuf = await sharp(logoBuffer).png().toBuffer();
        logoDataUri = `data:image/png;base64,${pngBuf.toString("base64")}`;
      }
    }

    // ── Step 7: Composite final image ──
    const finalBuffer = await compositeCreativeImage({
      backgroundBuffer,
      productBuffer,
      logoDataUri,
      brief,
    });
    console.log(`[autoCreative] Composited | elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

    // ── Step 8: Upload to Cloudinary ──
    const imageUrl = await uploadToCloudinary(finalBuffer, brandId);
    console.log(`[autoCreative] Uploaded | ${imageUrl}`);

    // ── Step 9: Generate caption ──
    const brandContext = await getBrandContext(brandId).catch(() => "");
    const campaignBrief = occasion
      ? `${occasion.name} promotional post for ${brand.brandName}. ${occasion.hook}. Product: ${brand.whatTheySell ?? brand.industry}.`
      : `Brand awareness post for ${brand.brandName}. ${brief.subheadline}. Product: ${brand.whatTheySell ?? brand.industry}.`;

    const { captions } = await generateCaptionSet(brandContext, campaignBrief, "promotional").catch(
      () => ({ captions: [], seo_keywords: [] })
    );

    const bestCaption = captions.length > 0 ? pickBestCaption(captions).selected : null;
    const captionText = bestCaption?.full_caption ?? `${brief.headline} — ${brief.subheadline}`;
    const hashtags = bestCaption?.hashtags ?? [];

    // ── Step 10: Save to database ──
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
