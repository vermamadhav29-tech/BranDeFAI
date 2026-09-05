/**
 * studioTestPromo.ts
 *
 * Builds a 1080×1080 Instagram promo post from the product photo alone.
 * Backdrop = original photo blurred + darkened (bokeh from product's world).
 * Foreground = BiRefNet transparent cutout.
 * All text / UI drawn with node-canvas (system fonts, works on Railway Linux).
 * Sharp handles only pixel operations: resize, blur, composite.
 *
 * Self-contained — no imports from the existing service pipeline.
 */

import sharp from "sharp";
import { createCanvas, loadImage } from "canvas";

type Logger = (msg: string) => void;

const W = 1080;
const H = 1080;

export interface PromoInput {
  productBuffer: Buffer;   // original photo — blurred backdrop source
  cutoutBuffer:  Buffer;   // BiRefNet transparent cutout (or fallback)
  logoBuffer?:   Buffer;
  brandName:     string;
  brandTagline:  string;
  headline:      string;   // 3-7 word headline from analyzeCreative
  subheadline:   string;   // 1 sentence from analyzeCreative
  cta:           string;   // 2-3 word CTA from analyzeCreative
  trustBullets:  string[]; // max 4 from analyzeCreative
  primaryColor:  string;   // hex e.g. "#1A7A4A"
  accentColor:   string;   // hex e.g. "#FFD700"
  postType:      "lifestyle" | "product_highlight";
  log:           Logger;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitHeadline(headline: string): [string, string] {
  const words = headline.trim().split(/\s+/);
  if (words.length <= 1) return [headline, ""];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxCharsPerLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Rounded-rect path helper (Canvas 2D doesn't have roundRect in all versions)
type Ctx2D = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
  ctx.closePath();
}

// Draw a 22×22 icon centred at (cx, cy) using Canvas 2D paths.
// Keyword-matched to the trust bullet text.
function drawIcon(ctx: Ctx2D, bullet: string, cx: number, cy: number, color: string) {
  const low = bullet.toLowerCase();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  if (/diamond|certified|real/.test(low)) {
    // Diamond
    ctx.beginPath();
    ctx.moveTo(cx,      cy - 11);
    ctx.lineTo(cx + 11, cy);
    ctx.lineTo(cx,      cy + 11);
    ctx.lineTo(cx - 11, cy);
    ctx.closePath();
    ctx.stroke();

  } else if (/gold|hallmark|karat|\bkt\b/.test(low)) {
    // Ring / circle
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();

  } else if (/gift|gifting|luxury/.test(low)) {
    // Gift box
    ctx.strokeRect(cx - 9, cy - 2, 18, 13);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2); ctx.lineTo(cx, cy + 11);
    ctx.stroke();
    // Bow loops
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2);
    ctx.bezierCurveTo(cx, cy - 2, cx - 5, cy - 9, cx - 8, cy - 7);
    ctx.bezierCurveTo(cx - 10, cy - 4, cx - 3, cy - 2, cx, cy - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2);
    ctx.bezierCurveTo(cx, cy - 2, cx + 5, cy - 9, cx + 8, cy - 7);
    ctx.bezierCurveTo(cx + 10, cy - 4, cx + 3, cy - 2, cx, cy - 2);
    ctx.stroke();

  } else if (/skin|hypoallergenic|safe/.test(low)) {
    // Shield
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx + 9, cy - 7);
    ctx.lineTo(cx + 9, cy + 2);
    ctx.bezierCurveTo(cx + 9, cy + 7, cx, cy + 11, cx, cy + 11);
    ctx.bezierCurveTo(cx, cy + 11, cx - 9, cy + 7, cx - 9, cy + 2);
    ctx.lineTo(cx - 9, cy - 7);
    ctx.closePath();
    ctx.stroke();

  } else {
    // Sparkle / star (default — also used for "craft", "made", etc.)
    const pts: [number, number][] = [
      [cx, cy - 11],
      [cx + 3, cy - 3],
      [cx + 11, cy - 3],
      [cx + 4.5, cy + 2],
      [cx + 7, cy + 10],
      [cx, cy + 5.5],
      [cx - 7, cy + 10],
      [cx - 4.5, cy + 2],
      [cx - 11, cy - 3],
      [cx - 3, cy - 3],
    ];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }
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

  // Bottom zone heights
  const ctaStripH  = hasCta ? 50 : 0;
  const trustH     = hasTrust ? 100 : 0;
  const bottomH    = ctaStripH + trustH;                  // total reserved bottom area
  const trustBarY  = H - ctaStripH - trustH;
  const ctaStripY  = H - ctaStripH;

  // ── 1. Blurred + darkened backdrop ──────────────────────────────────────────
  log("[promo] building backdrop...");
  const darkSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="rgba(0,0,0,0.42)"/></svg>`,
  );
  const backdrop = await sharp(productBuffer)
    .resize(W, H, { fit: "cover", position: "centre" })
    .blur(35)
    .composite([{ input: darkSvg, blend: "over" }])
    .png()
    .toBuffer();

  // ── 2. Scale + position cutout ───────────────────────────────────────────────
  log("[promo] scaling cutout...");
  const meta   = await sharp(cutoutBuffer).metadata();
  const cW     = meta.width  ?? 520;
  const cH     = meta.height ?? 520;
  const maxDim = Math.min(520, H - bottomH - 40);   // don't overlap trust bar
  const scale  = Math.min(maxDim / cW, maxDim / cH, 1);
  const scaledW = Math.round(cW * scale);
  const scaledH = Math.round(cH * scale);

  const cutoutResized = await sharp(cutoutBuffer)
    .resize(scaledW, scaledH)
    .png()
    .toBuffer();

  const cutLeft = Math.max(0, Math.round(W * 0.63 - scaledW / 2));
  const cutTop  = Math.max(0, Math.round((H - bottomH) * 0.48 - scaledH / 2));
  log(`[promo] cutout ${scaledW}×${scaledH} at (${cutLeft},${cutTop})`);

  // ── 3. Composite cutout on backdrop ─────────────────────────────────────────
  let canvas = await sharp(backdrop)
    .composite([{ input: cutoutResized, left: cutLeft, top: cutTop, blend: "over" }])
    .png()
    .toBuffer();

  // ── 4. Left-heavy gradient overlay ──────────────────────────────────────────
  const gradSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0%"   stop-color="rgba(0,0,0,0.82)"/>` +
    `<stop offset="48%"  stop-color="rgba(0,0,0,0.35)"/>` +
    `<stop offset="100%" stop-color="rgba(0,0,0,0.04)"/>` +
    `</linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
  );
  canvas = await sharp(canvas)
    .composite([{ input: gradSvg, blend: "over" }])
    .png()
    .toBuffer();

  // ── 5. Canvas text + UI layer ────────────────────────────────────────────────
  log("[promo] drawing text layer (canvas)...");
  const [hl1, hl2] = splitHeadline(headline);
  const subLines   = wrapText(subheadline, 34);

  const nc  = createCanvas(W, H);
  const ctx = nc.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  // ── Logo circle ──────────────────────────────────────────────────────────────
  const logoR  = 42;
  const logoX  = 36 + logoR;   // circle centre x
  const logoY  = 40 + logoR;   // circle centre y

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
  ctx.fill();

  if (logoBuffer) {
    try {
      const img  = await loadImage(logoBuffer);
      const s    = Math.min((logoR * 1.4) / img.width, (logoR * 1.4) / img.height);
      const lw   = img.width  * s;
      const lh   = img.height * s;
      // Clip to circle before drawing logo
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX, logoY, logoR - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, logoX - lw / 2, logoY - lh / 2, lw, lh);
      ctx.restore();
    } catch (_) { /* fall through to initials */ }
  }

  if (!logoBuffer) {
    const initials = brandName.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
    ctx.fillStyle   = primaryColor;
    ctx.font        = `bold ${logoR}px sans-serif`;
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, logoX, logoY);
  }

  // ── Brand name below logo ────────────────────────────────────────────────────
  const brandNameY = logoY + logoR + 20;
  ctx.fillStyle    = "rgba(255,255,255,0.95)";
  ctx.font         = "bold 18px sans-serif";
  ctx.textAlign    = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(brandName.toUpperCase(), 36, brandNameY);

  // ── Brand tagline ────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.60)";
  ctx.font      = "italic 13px sans-serif";
  ctx.fillText(brandTagline, 36, brandNameY + 22);

  // ── Headline line 1 ──────────────────────────────────────────────────────────
  const hl1Y = 390;
  ctx.fillStyle    = "rgba(255,255,255,0.97)";
  ctx.font         = "bold 72px sans-serif";
  ctx.textAlign    = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(hl1, 44, hl1Y);

  // ── Headline line 2 ──────────────────────────────────────────────────────────
  const hl2Y = hl1Y + 84;
  if (hl2) {
    ctx.fillStyle = accentColor;
    ctx.font      = "bold italic 72px sans-serif";
    ctx.fillText(hl2, 44, hl2Y);
  }

  // ── Accent rule ───────────────────────────────────────────────────────────────
  const ruleY = (hl2 ? hl2Y : hl1Y) + 16;
  ctx.fillStyle = accentColor;
  ctx.fillRect(44, ruleY, 70, 3);

  // ── Subheadline ───────────────────────────────────────────────────────────────
  ctx.fillStyle    = "rgba(255,255,255,0.80)";
  ctx.font         = "22px sans-serif";
  ctx.textAlign    = "left";
  ctx.textBaseline = "alphabetic";
  const subStart   = ruleY + 36;
  subLines.forEach((line, i) => ctx.fillText(line, 44, subStart + i * 32));

  // ── Trust bar ─────────────────────────────────────────────────────────────────
  if (hasTrust) {
    const bullets   = trustBullets.slice(0, 4);
    const sectionW  = Math.floor(W / bullets.length);

    // Dark strip
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, trustBarY, W, trustH);

    bullets.forEach((bullet, i) => {
      const sLeft   = i * sectionW;
      const sCx     = sLeft + sectionW / 2;      // column centre x

      // Vertical divider (all except first)
      if (i > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.20)";
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(sLeft, trustBarY + 16);
        ctx.lineTo(sLeft, trustBarY + trustH - 16);
        ctx.stroke();
      }

      // Icon centred in column, upper half of trust bar
      const iconCY = trustBarY + 34;
      drawIcon(ctx, bullet, sCx, iconCY, accentColor);

      // Label text centred below icon
      ctx.fillStyle    = "rgba(255,255,255,0.88)";
      ctx.font         = "bold 12px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "alphabetic";
      // Wrap long bullets to 2 lines
      const parts = wrapText(bullet, 16);
      parts.slice(0, 2).forEach((p, j) => {
        ctx.fillText(p, sCx, trustBarY + 62 + j * 16);
      });
    });
  }

  // ── CTA strip (product_highlight only) ───────────────────────────────────────
  if (hasCta) {
    // Dark strip
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.fillRect(0, ctaStripY, W, ctaStripH);

    // Tagline left-aligned
    ctx.fillStyle    = "rgba(255,255,255,0.72)";
    ctx.font         = "italic 14px sans-serif";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(brandTagline, 30, ctaStripY + ctaStripH / 2);

    // CTA pill button right-aligned
    const btnW  = 160;
    const btnH  = 36;
    const btnX  = W - btnW - 24;
    const btnY  = ctaStripY + (ctaStripH - btnH) / 2;

    ctx.fillStyle = "white";
    roundRect(ctx, btnX, btnY, btnW, btnH, 18);
    ctx.fill();

    ctx.fillStyle    = primaryColor;
    ctx.font         = "bold 14px sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${cta.toUpperCase()} →`, btnX + btnW / 2, btnY + btnH / 2);
  }

  // Export canvas to PNG buffer and composite onto Sharp image
  const textBuf = nc.toBuffer("image/png");

  canvas = await sharp(canvas)
    .composite([{ input: textBuf, blend: "over" }])
    .png()
    .toBuffer();

  // ── 6. Output JPEG ────────────────────────────────────────────────────────────
  log("[promo] encoding 1080×1080 JPEG...");
  const result = await sharp(canvas).jpeg({ quality: 92 }).toBuffer();
  log(`[promo] done — ${result.length} bytes`);
  return result;
}
