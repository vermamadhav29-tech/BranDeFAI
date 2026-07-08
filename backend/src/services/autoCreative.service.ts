import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import { createCanvas, loadImage } from "canvas";
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
    gradientDef = `<linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="black" stop-opacity="0.72"/>
      <stop offset="60%"  stop-color="black" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </linearGradient>`;
  } else if (layoutStyle === "split" && placement === "left") {
    gradientDef = `<linearGradient id="grad" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0%"   stop-color="black" stop-opacity="0.72"/>
      <stop offset="60%"  stop-color="black" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </linearGradient>`;
  } else if (layoutStyle === "overlay") {
    gradientDef = `<radialGradient id="grad" cx="50%" cy="50%" r="70%">
      <stop offset="0%"   stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.55"/>
    </radialGradient>`;
  } else {
    // minimal / full-bleed
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

// ─── Canvas text layer ────────────────────────────────────────────────────────
// Uses node-canvas (npm: canvas) for text rendering. Canvas uses system fonts
// via fontconfig on Linux — renders reliably on Railway without librsvg issues.

type Ctx2D = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

async function buildTextLayer(
  brief: CreativeBrief,
  logoBuffer: Buffer | null,
  canvasWidth: number,
  canvasHeight: number
): Promise<Buffer> {
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");
  const primary = brief.primary_color;
  const accent = brief.accent_color;

  // ── Logo (top-left) ──
  if (logoBuffer) {
    try {
      const logoImg = await loadImage(logoBuffer);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(logoImg, 40, 40, 200, 70);
      ctx.globalAlpha = 1;
    } catch {
      // skip if logo fails to load
    }
  }

  // ── Occasion badge (top-right pill) ──
  if (brief.occasion_badge) {
    const OCC_X = 820, OCC_Y = 35, OCC_W = 220, OCC_H = 44;
    roundRect(ctx, OCC_X, OCC_Y, OCC_W, OCC_H, 22);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = primary;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brief.occasion_badge, OCC_X + OCC_W / 2, OCC_Y + OCC_H / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // ── Headline line 1 (white) ──
  ctx.font = "bold 68px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(brief.headline, 40, 420);

  // ── Headline line 2 / accent ──
  ctx.font = "bold 68px sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText(brief.headline_accent, 40, 500);

  // ── Subheadline ──
  ctx.font = "22px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(brief.subheadline, 40, 560);

  // ── Divider line ──
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 590);
  ctx.lineTo(200, 590);
  ctx.stroke();

  // ── Feature badges (horizontal row, y=630) ──
  const badges = (brief.feature_badges ?? []).slice(0, 3);
  const BADGE_Y = 630;
  const BADGE_H = 32;
  const BADGE_PAD = 14;
  let badgeX = 40;

  ctx.font = "13px sans-serif";
  for (const badge of badges) {
    const textW = ctx.measureText(badge).width;
    const badgeW = Math.max(80, textW + BADGE_PAD * 2);
    if (badgeX + badgeW > 480) break;

    roundRect(ctx, badgeX, BADGE_Y, badgeW, BADGE_H, 14);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.textBaseline = "middle";
    ctx.fillText(badge, badgeX + BADGE_PAD, BADGE_Y + BADGE_H / 2);
    ctx.textBaseline = "alphabetic";

    badgeX += badgeW + 12;
  }

  // ── Bottom bar ──
  ctx.globalAlpha = 0.90;
  ctx.fillStyle = primary;
  ctx.fillRect(0, 1260, canvasWidth, 90);
  ctx.globalAlpha = 1;

  if (brief.tagline) {
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.textBaseline = "middle";
    ctx.fillText(brief.tagline, 40, 1305);
    ctx.textBaseline = "alphabetic";
  }

  // ── CTA button ──
  const CTA_X = 830, CTA_Y = 1268, CTA_W = 200, CTA_H = 52;
  roundRect(ctx, CTA_X, CTA_Y, CTA_W, CTA_H, 22);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.font = "bold 15px sans-serif";
  ctx.fillStyle = primary;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(brief.cta, CTA_X + CTA_W / 2, CTA_Y + CTA_H / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return canvas.toBuffer("image/png");
}

// ─── Sharp compositing ────────────────────────────────────────────────────────

async function compositeCreativeImage(opts: {
  backgroundBuffer: Buffer;
  productBuffer: Buffer;
  logoBuffer: Buffer | null;
  brief: CreativeBrief;
}): Promise<Buffer> {
  const { backgroundBuffer, productBuffer, logoBuffer, brief } = opts;

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

  // ── Product placement coordinates ──
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

  productLeft = Math.max(0, Math.min(productLeft, CANVAS_W - productW));
  productTop = Math.max(0, Math.min(productTop, CANVAS_H - productH - 90));

  // ── Drop shadow (blur 25px) ──
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

  // ── Canvas text layer ──
  const textBuffer = await buildTextLayer(brief, logoBuffer, CANVAS_W, CANVAS_H);

  // ── Composite: background → gradient → product → text ──
  const composites: OverlayOptions[] = [
    { input: buildGradientSvg(brief.layout_style, placement), left: 0, top: 0 },
    {
      input: productWithShadow,
      left: Math.max(0, productLeft - shadowPad),
      top: Math.max(0, productTop - shadowPad),
    },
    { input: textBuffer, left: 0, top: 0 },
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

    // ── Step 4: Generate background via Flux 2 Pro ──
    const backgroundBuffer = await generateFluxBackground(brief.flux_prompt, brief.flux_negative);
    console.log(`[autoCreative] Background | elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

    // ── Step 5: Fetch product image ──
    const productBuffer = await fetchBuffer(productImage.imageUrl);

    // ── Step 6: Fetch logo buffer for canvas rendering ──
    let logoBuffer: Buffer | null = null;
    if (brand.logoUrl) {
      logoBuffer = await fetchBuffer(brand.logoUrl).catch(() => null);
    }

    // ── Step 7: Composite final image ──
    const finalBuffer = await compositeCreativeImage({
      backgroundBuffer,
      productBuffer,
      logoBuffer,
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
