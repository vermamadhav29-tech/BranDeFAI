/**
 * studioTestAssets.ts
 *
 * All rendering helpers for the Studio-Test promo pipeline.
 * Import from here into studioTestPromo.ts — keeps the compositing
 * logic separate from the drawing primitives, icon library, and
 * backdrop builder.
 *
 * Exports
 *   registerBundledFonts()   — call once at module load
 *   darkVariant()            — create a very dark hue-preserving colour
 *   Ctx2D                    — Canvas 2D context type alias
 *   roundRect()              — rounded rectangle path helper
 *   drawIcon()               — keyword-matched icon for trust bullets
 *   buildPremiumBackdrop()   — blurred photo + brand gradient + spotlight
 */

import path from "path";
import { createCanvas, registerFont } from "canvas";
import sharp from "sharp";

// ─── Font registration ────────────────────────────────────────────────────────

let _fontsRegistered = false;

export function registerBundledFonts(): void {
  if (_fontsRegistered) return;
  try {
    const dir = path.join(__dirname, "..", "..", "assets", "fonts");
    registerFont(path.join(dir, "NotoSans-Regular.ttf"), { family: "Noto Sans" });
    registerFont(path.join(dir, "NotoSans-Bold.ttf"),    { family: "Noto Sans", weight: "bold" });
    _fontsRegistered = true;
  } catch (_) {
    // Falls back to whatever system fonts Canvas finds (should not happen on Railway
    // after nixpacks installs liberation_ttf, but we don't want a crash).
  }
}

// ─── Colour utility ───────────────────────────────────────────────────────────

/**
 * Returns a very dark version of the hex colour (hue preserved).
 * factor=0.10 → 10 % brightness (near-black with a hint of the hue).
 */
export function darkVariant(hex: string, factor = 0.10): string {
  const clean = hex.replace(/^#/, "");
  if (clean.length < 6) return "#0d0d0d";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#0d0d0d";
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

// ─── Canvas 2D context type ───────────────────────────────────────────────────

export type Ctx2D = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

// ─── Rounded-rect path helper ─────────────────────────────────────────────────

export function roundRect(
  ctx: Ctx2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
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

// ─── Icon drawing ─────────────────────────────────────────────────────────────
//
// Keyword-matched to the trust-bullet text. Each icon is 22 × 22 px, centred
// at (cx, cy). Precedence: first match wins.

export function drawIcon(
  ctx: Ctx2D,
  bullet: string,
  cx: number,
  cy: number,
  color: string,
): void {
  const low = bullet.toLowerCase();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  // ── Metal / silver / gold ──────────────────────────────────────────────────
  if (/silver|sterling|oxidis|oxidiz|rhodium|platinum|brass|copper|metal|finish/.test(low)) {
    // Three horizontal bars (like a metal ingot / layered sheets)
    for (const dy of [-5, 0, 5]) {
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + dy);
      ctx.lineTo(cx + 10, cy + dy);
      ctx.stroke();
    }

  // ── Gemstone ───────────────────────────────────────────────────────────────
  } else if (/topaz|ruby|emerald|sapphire|garnet|amethyst|opal|pearl|diamond|stone|gem|crystal|zirconia|\bcut\b|teardrop|oval|marquise|facet|pavé|pave/.test(low)) {
    // Hexagonal faceted gem with belt lines
    ctx.beginPath();
    ctx.moveTo(cx,      cy - 11);
    ctx.lineTo(cx + 10, cy - 2);
    ctx.lineTo(cx + 10, cy + 4);
    ctx.lineTo(cx,      cy + 11);
    ctx.lineTo(cx - 10, cy + 4);
    ctx.lineTo(cx - 10, cy - 2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 2); ctx.lineTo(cx + 10, cy - 2);
    ctx.moveTo(cx - 10, cy + 4); ctx.lineTo(cx + 10, cy + 4);
    ctx.moveTo(cx,      cy - 11); ctx.lineTo(cx, cy + 11);
    ctx.stroke();

  // ── Art Deco / design / ornamental ────────────────────────────────────────
  } else if (/deco|art|design|antique|vintage|pattern|geometric|arch|boho|floral|crescent|filigree|engraved|ornament|inspired/.test(low)) {
    // Fan burst — Art Deco motif
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    for (const deg of [-60, -30, 0, 30, 60]) {
      const rad = (deg - 90) * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * 4,  cy + Math.sin(rad) * 4);
      ctx.lineTo(cx + Math.cos(rad) * 11, cy + Math.sin(rad) * 11);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 11, -Math.PI, 0);
    ctx.stroke();

  // ── Gold / karat / hallmark ────────────────────────────────────────────────
  } else if (/gold|karat|\bkt\b|hallmark/.test(low)) {
    // Two concentric circles (coin / ring top view)
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke();

  // ── Certified / authentic / genuine ───────────────────────────────────────
  } else if (/certif|authentic|genuine|real|quality|verified|hallmark/.test(low)) {
    // Tick inside circle
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy);
    ctx.lineTo(cx - 1, cy + 5);
    ctx.lineTo(cx + 6, cy - 5);
    ctx.stroke();
    ctx.lineWidth = 1.8;

  // ── Hypoallergenic / safe ──────────────────────────────────────────────────
  } else if (/skin|hypoallerg|safe|allerg|nickel/.test(low)) {
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

  // ── Gift / gifting / occasion ──────────────────────────────────────────────
  } else if (/gift|gifting|occasion/.test(low)) {
    // Gift box with bow
    ctx.strokeRect(cx - 9, cy - 2, 18, 13);
    ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx, cy + 11); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 2);
      ctx.bezierCurveTo(cx, cy - 2, cx + side * 5, cy - 9, cx + side * 8, cy - 7);
      ctx.bezierCurveTo(cx + side * 10, cy - 4, cx + side * 3, cy - 2, cx, cy - 2);
      ctx.stroke();
    }

  // ── Hand-crafted / intricate / precision ──────────────────────────────────
  } else if (/hand.craf|hand.set|intricate|precision|crafted|artisan/.test(low)) {
    // Sparkle cluster (tight group of dots + rays)
    const spots: [number, number, number][] = [
      [cx, cy, 2.5], [cx - 6, cy - 5, 1.5], [cx + 6, cy - 5, 1.5], [cx, cy - 10, 1],
    ];
    for (const [sx, sy, sr] of spots) {
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    for (const deg of [0, 90, 180, 270]) {
      const rad = deg * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * 3, cy + Math.sin(rad) * 3);
      ctx.lineTo(cx + Math.cos(rad) * 10, cy + Math.sin(rad) * 10);
      ctx.stroke();
    }

  // ── Default: 10-point sparkle star ────────────────────────────────────────
  } else {
    const pts: [number, number][] = [
      [cx,      cy - 11], [cx + 3,   cy - 3],
      [cx + 11, cy - 3],  [cx + 4.5, cy + 2],
      [cx + 7,  cy + 10], [cx,       cy + 5.5],
      [cx - 7,  cy + 10], [cx - 4.5, cy + 2],
      [cx - 11, cy - 3],  [cx - 3,   cy - 3],
    ];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }
}

// ─── Premium backdrop ─────────────────────────────────────────────────────────

/**
 * Builds the 1080×1080 backdrop:
 *   1. Original photo → very heavy blur + near-black overlay (photo-world texture)
 *   2. Brand-coloured diagonal gradient on the left text zone
 *   3. Soft radial spotlight centred at the product position
 *
 * Result: looks like a designed studio backdrop, not a plain photo blur.
 */
export async function buildPremiumBackdrop(
  originalBuffer:  Buffer,
  W:               number,
  H:               number,
  primaryColor:    string,
  productCenterX:  number,
  productCenterY:  number,
): Promise<Buffer> {
  const dark = darkVariant(primaryColor, 0.10);

  // 1. Blurred original + heavy darkness (photo-world context without dominating)
  const blurDark = await sharp(originalBuffer)
    .resize(W, H, { fit: "cover", position: "centre" })
    .blur(60)
    .composite([{
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
        `<rect width="${W}" height="${H}" fill="rgba(0,0,0,0.80)"/></svg>`,
      ),
      blend: "over",
    }])
    .png()
    .toBuffer();

  // 2. Branded left-zone gradient (gives the "designed" feel vs plain dark)
  const gradSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0%"   stop-color="${dark}" stop-opacity="0.90"/>` +
    `<stop offset="52%"  stop-color="${dark}" stop-opacity="0.28"/>` +
    `<stop offset="100%" stop-color="${dark}" stop-opacity="0"/>` +
    `</linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
  );

  let backdrop = await sharp(blurDark)
    .composite([{ input: gradSvg, blend: "over" }])
    .png()
    .toBuffer();

  // 3. Radial spotlight centred on the product (makes product look lit)
  const spotSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs>` +
    `<radialGradient id="spot" cx="${productCenterX}" cy="${productCenterY}" r="430"` +
    ` fx="${productCenterX}" fy="${productCenterY}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0%"   stop-color="rgba(255,255,255,0.22)"/>` +
    `<stop offset="55%"  stop-color="rgba(255,255,255,0.05)"/>` +
    `<stop offset="100%" stop-color="rgba(0,0,0,0)"/>` +
    `</radialGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#spot)"/></svg>`,
  );

  backdrop = await sharp(backdrop)
    .composite([{ input: spotSvg, blend: "screen" }])
    .png()
    .toBuffer();

  return backdrop;
}
