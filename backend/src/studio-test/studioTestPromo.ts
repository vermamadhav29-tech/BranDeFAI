/**
 * studioTestPromo.ts
 *
 * Builds a 1080×1080 Instagram promo post.
 *
 * Backdrop  = original photo heavily blurred + branded gradient + spotlight
 * Foreground = BiRefNet transparent cutout (with product glow)
 * Text / UI  = Canvas 2D layer (Noto Sans, registered via studioTestAssets)
 *
 * All drawing helpers live in studioTestAssets.ts.
 * Self-contained — no imports from the existing service pipeline.
 */

import sharp from "sharp";
import { createCanvas, loadImage } from "canvas";
import {
  registerBundledFonts,
  type Ctx2D,
  roundRect,
  drawIcon,
  buildPremiumBackdrop,
} from "./studioTestAssets";

// Register bundled Noto Sans fonts once at module load.
registerBundledFonts();

const W = 1080;
const H = 1080;

// ─── Public interface ─────────────────────────────────────────────────────────

export interface PromoInput {
  productBuffer: Buffer;   // original photo — backdrop source
  cutoutBuffer:  Buffer;   // BiRefNet transparent cutout (or fallback)
  logoBuffer?:   Buffer;
  brandName:     string;
  brandTagline:  string;
  headline:      string;
  subheadline:   string;
  cta:           string;
  trustBullets:  string[]; // max 4
  primaryColor:  string;   // hex e.g. "#1A7A4A"
  accentColor:   string;   // hex e.g. "#FFD700"
  postType:      "lifestyle" | "product_highlight";
  log:           Logger;
}

type Logger = (msg: string) => void;

// ─── Text helpers ─────────────────────────────────────────────────────────────

function splitHeadline(headline: string): [string, string] {
  const words = headline.trim().split(/\s+/);
  if (words.length <= 1) return [headline, ""];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxChars && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function buildPromoPost(input: PromoInput): Promise<Buffer> {
  const {
    productBuffer, cutoutBuffer, logoBuffer,
    brandName, brandTagline, headline, subheadline, cta,
    trustBullets, primaryColor, accentColor, postType, log,
  } = input;

  const hasTrust  = trustBullets.length > 0;
  const hasCta    = postType === "product_highlight";
  const ctaStripH = hasCta   ? 54 : 0;
  const trustH    = hasTrust ? 110 : 0;
  const bottomH   = ctaStripH + trustH;
  const trustBarY = H - ctaStripH - trustH;
  const ctaStripY = H - ctaStripH;

  // ── 1. Scale cutout → determine product position first ─────────────────────
  log("[promo] measuring cutout...");
  const meta   = await sharp(cutoutBuffer).metadata();
  const cW     = meta.width  ?? 540;
  const cH     = meta.height ?? 540;
  const maxDim = Math.min(580, H - bottomH - 50);   // product can be up to 580px
  const scale  = Math.min(maxDim / cW, maxDim / cH, 1);
  const scaledW = Math.round(cW * scale);
  const scaledH = Math.round(cH * scale);

  const cutoutResized = await sharp(cutoutBuffer)
    .resize(scaledW, scaledH)
    .png()
    .toBuffer();

  // Position: right-centre (63 % from left) — portrait jewellery items are tall
  const cutLeft = Math.max(0, Math.round(W * 0.63 - scaledW / 2));
  const cutTop  = Math.max(0, Math.round((H - bottomH) * 0.46 - scaledH / 2));
  const productCX = cutLeft + scaledW / 2;
  const productCY = cutTop  + scaledH / 2;
  log(`[promo] product ${scaledW}×${scaledH} at (${cutLeft},${cutTop}) centre (${Math.round(productCX)},${Math.round(productCY)})`);

  // ── 2. Premium backdrop (blurred photo + brand gradient + spotlight) ────────
  log("[promo] building premium backdrop...");
  let canvas = await buildPremiumBackdrop(
    productBuffer, W, H, primaryColor, productCX, productCY,
  );

  // ── 3. Product glow halo (soft radial, composited before the cutout) ────────
  const haloSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs>` +
    `<radialGradient id="h" cx="${productCX}" cy="${productCY}" r="${Math.max(scaledW, scaledH) * 0.72}"` +
    ` gradientUnits="userSpaceOnUse">` +
    `<stop offset="0%"   stop-color="rgba(255,255,255,0.18)"/>` +
    `<stop offset="100%" stop-color="rgba(0,0,0,0)"/>` +
    `</radialGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#h)"/></svg>`,
  );
  canvas = await sharp(canvas)
    .composite([{ input: haloSvg, blend: "screen" }])
    .png()
    .toBuffer();

  // ── 4. Composite cutout (foreground product) ────────────────────────────────
  log("[promo] compositing cutout...");
  canvas = await sharp(canvas)
    .composite([{ input: cutoutResized, left: cutLeft, top: cutTop, blend: "over" }])
    .png()
    .toBuffer();

  // ── 5. Canvas text + UI layer ────────────────────────────────────────────────
  log("[promo] drawing text / UI layer...");
  const [hl1, hl2] = splitHeadline(headline);
  const subLines   = wrapText(subheadline, 34);

  const nc  = createCanvas(W, H);
  const ctx = nc.getContext("2d") as Ctx2D;
  ctx.clearRect(0, 0, W, H);

  // ── Logo (no filled circle — just the image or bold initials) ───────────────
  //    product_highlight → top-left   |   lifestyle → top-right
  const isLifestyle = postType === "lifestyle";
  const LOGO_MAX    = 64;
  const LOGO_PAD_X  = 44;
  const LOGO_PAD_Y  = 40;

  let logoDrawY   = LOGO_PAD_Y;
  let logoRenderedH = 0;
  let logoDrawX   = isLifestyle ? W - LOGO_PAD_X : LOGO_PAD_X;
  let drewLogoImg = false;

  if (logoBuffer) {
    try {
      const img = await loadImage(logoBuffer);
      const s   = Math.min(LOGO_MAX / img.width, LOGO_MAX / img.height);
      const lw  = img.width * s;
      const lh  = img.height * s;
      logoDrawX = isLifestyle ? W - LOGO_PAD_X - lw : LOGO_PAD_X;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.70)";
      ctx.shadowBlur  = 10;
      roundRect(ctx, logoDrawX, logoDrawY, lw, lh, 8);
      ctx.clip();
      ctx.drawImage(img, logoDrawX, logoDrawY, lw, lh);
      ctx.restore();

      logoRenderedH = lh;
      drewLogoImg   = true;
    } catch (_) {
      // fall through to initials
    }
  }

  if (!drewLogoImg) {
    const initials = brandName
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const initFontSz = 44;

    ctx.save();
    ctx.shadowColor  = "rgba(0,0,0,0.80)";
    ctx.shadowBlur   = 14;
    ctx.fillStyle    = "rgba(255,255,255,0.96)";
    ctx.font         = `bold ${initFontSz}px 'Noto Sans'`;
    ctx.textAlign    = isLifestyle ? "right" : "left";
    ctx.textBaseline = "top";
    ctx.fillText(initials, logoDrawX, logoDrawY);
    ctx.restore();

    logoRenderedH = initFontSz;
  }

  // Brand name + tagline below logo
  const brandNameY  = logoDrawY + logoRenderedH + 12;
  const textAnchorX = isLifestyle ? W - LOGO_PAD_X : LOGO_PAD_X;

  ctx.save();
  ctx.shadowColor  = "rgba(0,0,0,0.70)";
  ctx.shadowBlur   = 6;
  ctx.fillStyle    = "rgba(255,255,255,0.95)";
  ctx.font         = "bold 16px 'Noto Sans'";
  ctx.textAlign    = isLifestyle ? "right" : "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(brandName.toUpperCase(), textAnchorX, brandNameY);

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.font      = "13px 'Noto Sans'";
  ctx.fillText(brandTagline, textAnchorX, brandNameY + 20);
  ctx.restore();

  // ── Headline ─────────────────────────────────────────────────────────────────
  const hl1Y = 390;
  ctx.save();
  ctx.shadowColor  = "rgba(0,0,0,0.60)";
  ctx.shadowBlur   = 8;
  ctx.fillStyle    = "rgba(255,255,255,0.97)";
  ctx.font         = "bold 72px 'Noto Sans'";
  ctx.textAlign    = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(hl1, 44, hl1Y);

  const hl2Y = hl1Y + 84;
  if (hl2) {
    ctx.fillStyle = accentColor;
    ctx.font      = "bold 72px 'Noto Sans'";
    ctx.fillText(hl2, 44, hl2Y);
  }
  ctx.restore();

  // ── Accent rule ───────────────────────────────────────────────────────────────
  const ruleY = (hl2 ? hl2Y : hl1Y) + 16;
  ctx.fillStyle = accentColor;
  ctx.fillRect(44, ruleY, 70, 3);

  // ── Subheadline ───────────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor  = "rgba(0,0,0,0.50)";
  ctx.shadowBlur   = 4;
  ctx.fillStyle    = "rgba(255,255,255,0.80)";
  ctx.font         = "22px 'Noto Sans'";
  ctx.textAlign    = "left";
  ctx.textBaseline = "alphabetic";
  const subStart = ruleY + 36;
  subLines.forEach((line, i) => ctx.fillText(line, 44, subStart + i * 32));
  ctx.restore();

  // ── Trust bar ─────────────────────────────────────────────────────────────────
  if (hasTrust) {
    const bullets  = trustBullets.slice(0, 4);
    const sectionW = Math.floor(W / bullets.length);

    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.fillRect(0, trustBarY, W, trustH);

    // Thin accent line at top of trust bar
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, trustBarY, W, 2);

    bullets.forEach((bullet, i) => {
      const sCx = i * sectionW + sectionW / 2;

      // Vertical divider
      if (i > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(i * sectionW, trustBarY + 16);
        ctx.lineTo(i * sectionW, trustBarY + trustH - 16);
        ctx.stroke();
      }

      // Icon — centred in upper half of the trust bar
      drawIcon(ctx, bullet, sCx, trustBarY + 34, accentColor);

      // Label text — centred below icon
      ctx.fillStyle    = "rgba(255,255,255,0.90)";
      ctx.font         = "bold 11px 'Noto Sans'";
      ctx.textAlign    = "center";
      ctx.textBaseline = "alphabetic";
      const parts = wrapText(bullet, 18).slice(0, 2);
      parts.forEach((p, j) => ctx.fillText(p, sCx, trustBarY + 66 + j * 16));
    });
  }

  // ── CTA strip (product_highlight only) ───────────────────────────────────────
  if (hasCta) {
    ctx.fillStyle = "rgba(0,0,0,0.90)";
    ctx.fillRect(0, ctaStripY, W, ctaStripH);

    // Accent line at top of CTA strip
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, ctaStripY, W, 2);

    // Tagline left
    ctx.fillStyle    = "rgba(255,255,255,0.70)";
    ctx.font         = "13px 'Noto Sans'";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(brandTagline, 30, ctaStripY + ctaStripH / 2);

    // CTA pill button right
    const btnW = 170, btnH = 38;
    const btnX = W - btnW - 24;
    const btnY = ctaStripY + (ctaStripH - btnH) / 2;

    ctx.fillStyle = "white";
    roundRect(ctx, btnX, btnY, btnW, btnH, 19);
    ctx.fill();

    ctx.fillStyle    = primaryColor;
    ctx.font         = "bold 13px 'Noto Sans'";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${cta.toUpperCase()} →`, btnX + btnW / 2, btnY + btnH / 2);
  }

  // ── Composite text layer ──────────────────────────────────────────────────────
  const textBuf = nc.toBuffer("image/png");
  canvas = await sharp(canvas)
    .composite([{ input: textBuf, blend: "over" }])
    .png()
    .toBuffer();

  // ── Output 1080×1080 JPEG ────────────────────────────────────────────────────
  log("[promo] encoding 1080×1080 JPEG...");
  const result = await sharp(canvas).jpeg({ quality: 93 }).toBuffer();
  log(`[promo] done — ${result.length} bytes`);
  return result;
}
