/**
 * studioTestAssets.ts — pixel-level helpers for the promo renderer.
 *
 *   renderIcon()            Lucide SVG → tinted PNG
 *   prepareLogo()           analyse logo, make it read on the backdrop (mono silhouette / card)
 *   buildShadowLayer()      soft contact shadow from the cutout's alpha
 *   shadeSvg()              legibility gradient over the text zone
 *   spotlightSvg()          soft radial light behind the product
 *   buildPremiumBackdrop()  fallback backdrop when no library background is available
 *   roundRect()             canvas path helper
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import type { Ctx2D } from "./typeEngine";

export type Tone = "dark" | "light";

// ─── Colour utils ─────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const c = hex.replace(/^#/, "");
  if (c.length !== 6) return null;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return [r, g, b].some(isNaN) ? null : { r, g, b };
}

export function luminance(hex: string): number {
  const c = hexToRgb(hex);
  return c ? (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 : 0.5;
}

export function darkVariant(hex: string, factor = 0.10): string {
  const c = hexToRgb(hex);
  if (!c) return "#0d0d0d";
  return `rgb(${Math.round(c.r * factor)},${Math.round(c.g * factor)},${Math.round(c.b * factor)})`;
}

/** Accent colour that is guaranteed to read on the backdrop tone. */
export function resolveAccent(accent: string, primary: string, tone: Tone): string {
  const la = luminance(accent);
  if (tone === "dark"  && la < 0.25) return luminance(primary) > 0.45 ? primary : "#FFFFFF";
  if (tone === "light" && la > 0.80) return luminance(primary) < 0.60 ? primary : "#1A1A1A";
  return accent;
}

// ─── Canvas path helper ───────────────────────────────────────────────────────

export function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
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

// ─── Lucide icons ─────────────────────────────────────────────────────────────

let _lucideDir: string | null = null;
function lucideDir(): string {
  if (!_lucideDir) {
    _lucideDir = path.join(path.dirname(require.resolve("lucide-static/package.json")), "icons");
  }
  return _lucideDir;
}

const _iconCache = new Map<string, Buffer>();

/** Renders a Lucide icon to a tinted PNG (size × size). Returns null if the id is unknown. */
export async function renderIcon(iconId: string, size: number, color: string): Promise<Buffer | null> {
  const key = `${iconId}|${size}|${color}`;
  const hit = _iconCache.get(key);
  if (hit) return hit;

  const file = path.join(lucideDir(), `${iconId}.svg`);
  if (!fs.existsSync(file)) return null;

  const svg = fs.readFileSync(file, "utf8")
    .replace(/stroke="currentColor"/, `stroke="${color}"`)
    .replace(/width="24"/,  `width="${size}"`)
    .replace(/height="24"/, `height="${size}"`)
    .replace(/stroke-width="2"/, 'stroke-width="1.6"');

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  _iconCache.set(key, png);
  return png;
}

// ─── Logo preparation ─────────────────────────────────────────────────────────

/**
 * Makes the logo legible on the backdrop:
 *   transparent logo whose ink fights the tone  → monochrome silhouette in the text colour
 *   transparent logo that already reads          → unchanged
 *   opaque logo (JPEG / white box)               → unchanged, caller draws it on a small card
 */
export async function prepareLogo(
  logo: Buffer,
  tone: Tone,
): Promise<{ png: Buffer; onCard: boolean }> {
  const base = sharp(logo).ensureAlpha();
  const png  = await base.png().toBuffer();
  const { data, info } = await sharp(png)
    .resize(160, 160, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let opaque = 0, lumSum = 0;
  const total = info.width * info.height;
  for (let p = 0; p < data.length; p += 4) {
    const a = data[p + 3];
    if (a < 40) continue;
    opaque++;
    lumSum += (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
  }
  const transparentRatio = 1 - opaque / total;
  const inkLum = opaque ? lumSum / opaque : 0.5;

  if (transparentRatio < 0.12) return { png, onCard: true };

  const fights = (tone === "dark" && inkLum < 0.45) || (tone === "light" && inkLum > 0.62);
  if (!fights) return { png, onCard: false };

  const meta = await sharp(png).metadata();
  const fill = tone === "dark" ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: 22, g: 22, b: 22, alpha: 1 };
  const silhouette = await sharp({
    create: { width: meta.width!, height: meta.height!, channels: 4, background: fill },
  })
    .composite([{ input: png, blend: "dest-in" }])
    .png()
    .toBuffer();

  return { png: silhouette, onCard: false };
}

// ─── Contact shadow ───────────────────────────────────────────────────────────

/** Full-canvas RGBA layer containing a blurred, offset silhouette of the cutout. */
export async function buildShadowLayer(
  cutoutPng: Buffer,
  w: number, h: number,
  left: number, top: number,
  W: number, H: number,
  tone: Tone,
): Promise<Buffer> {
  const opacity = tone === "dark" ? 0.62 : 0.34;
  const dy = Math.min(26, Math.max(0, H - (top + h) - 2));
  const dx = 6;

  const silhouette = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: opacity } },
  })
    .composite([{ input: cutoutPng, blend: "dest-in" }])
    .png()
    .toBuffer();

  const layer = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: silhouette, left: Math.min(left + dx, W - w), top: top + dy }])
    .png()
    .toBuffer();

  return sharp(layer).blur(22).png().toBuffer();
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

export function shadeSvg(W: number, H: number, dir: "left" | "right" | "top" | "bottom", tone: Tone): Buffer {
  const c = tone === "dark" ? "0,0,0" : "255,255,255";
  const a0 = tone === "dark" ? 0.62 : 0.55;
  const coords =
    dir === "left"  ? 'x1="0" y1="0" x2="1" y2="0"' :
    dir === "right" ? 'x1="1" y1="0" x2="0" y2="0"' :
    dir === "top"   ? 'x1="0" y1="0" x2="0" y2="1"' :
                      'x1="0" y1="1" x2="0" y2="0"';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs><linearGradient id="g" ${coords}>` +
    `<stop offset="0%"   stop-color="rgba(${c},${a0})"/>` +
    `<stop offset="45%"  stop-color="rgba(${c},${a0 * 0.45})"/>` +
    `<stop offset="70%"  stop-color="rgba(${c},0)"/>` +
    `</linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
  );
}

export function spotlightSvg(W: number, H: number, cx: number, cy: number, r: number, alpha: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs><radialGradient id="s" cx="${cx}" cy="${cy}" r="${r}" fx="${cx}" fy="${cy}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0%"   stop-color="rgba(255,255,255,${alpha})"/>` +
    `<stop offset="60%"  stop-color="rgba(255,255,255,${alpha * 0.25})"/>` +
    `<stop offset="100%" stop-color="rgba(255,255,255,0)"/>` +
    `</radialGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#s)"/></svg>`,
  );
}

// ─── Fallback backdrop (no library background available) ──────────────────────

export async function buildPremiumBackdrop(
  originalBuffer: Buffer,
  W: number, H: number,
  primaryColor: string,
  productCX: number, productCY: number,
): Promise<Buffer> {
  const dark = darkVariant(primaryColor, 0.10);

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

  const tint = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%"   stop-color="${dark}" stop-opacity="0.85"/>` +
    `<stop offset="100%" stop-color="${dark}" stop-opacity="0.15"/>` +
    `</linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
  );

  return sharp(blurDark)
    .composite([
      { input: tint, blend: "over" },
      { input: spotlightSvg(W, H, productCX, productCY, 430, 0.22), blend: "screen" },
    ])
    .png()
    .toBuffer();
}
