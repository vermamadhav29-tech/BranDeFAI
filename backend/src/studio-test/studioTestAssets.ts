/**
 * studioTestAssets.ts — pixel-level helpers for the promo renderer.
 *
 *   renderIcon()            Lucide SVG → tinted PNG
 *   refineCutout()          erode BiRefNet's contaminated edge pixels off a cutout
 *   prepareLogo()           auto-remove a flat logo background, or fall back to a card
 *   buildShadowLayer()      soft contact shadow from the cutout's alpha
 *   shadeSvg()              legibility gradient over the text zone
 *   spotlightSvg()          soft radial light behind the product
 *   buildPremiumBackdrop()  fallback backdrop when no generated/library background is available
 *   roundRect()             canvas path helper
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import type { Ctx2D } from "./typeEngine";
import type { LogoHint } from "./logoVision";

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

// ─── Cutout refinement ────────────────────────────────────────────────────────

/**
 * BiRefNet's semi-transparent edge pixels retain a blend of the original
 * background's colour (classic alpha-matting fringing) — around fine detail
 * like filigree or lattice-work this shows up as a visible halo once the
 * cutout sits on a different backdrop. Fix: shrink the alpha mask inward by
 * ~2px so the contaminated boundary band becomes fully transparent instead
 * of partially visible with the wrong colour, then re-soften the new edge.
 */
export async function refineCutout(buf: Buffer, log?: Logger): Promise<Buffer> {
  try {
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return buf;

    const alphaRaw = await sharp(buf).ensureAlpha().extractChannel(3).png().toBuffer();

    // blur softens the edge → steep ramp culls the contaminated band (erosion) →
    // light re-blur restores clean anti-aliasing on the now-uncontaminated edge.
    const erodedAlpha = await sharp(alphaRaw)
      .blur(2)
      .linear(3.4, -540)
      .blur(0.6)
      .png()
      .toBuffer();

    const rgb = await sharp(buf).ensureAlpha().removeAlpha().png().toBuffer();

    return await sharp(rgb).joinChannel(erodedAlpha).png().toBuffer();
  } catch (err) {
    log?.(`[cutout] refine failed, using raw cutout: ${err instanceof Error ? err.message : String(err)}`);
    return buf;
  }
}

// ─── Logo preparation ─────────────────────────────────────────────────────────

type Logger = (msg: string) => void;

export interface PreparedLogo {
  png: Buffer;
  onCard: boolean;        // true = couldn't clean it; shown on a plain backing card
  isFullLockup: boolean;  // true = treat as a complete brand mark (name likely baked in) — suppress separate name text
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * Average colour over the OPAQUE pixels of a patch only. Returns null if the
 * patch is essentially all transparent (no usable colour signal there) —
 * critically, does NOT fall back to Sharp's removeAlpha() default of
 * flattening transparent pixels to black, which previously made a rounded
 * corner's real transparency read as "the background colour is black".
 */
async function averageColor(buf: Buffer): Promise<[number, number, number] | null> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let p = 0; p + 3 < data.length; p += 4) {
    if (data[p + 3] < 40) continue; // skip transparent/near-transparent pixels
    r += data[p]; g += data[p + 1]; b += data[p + 2]; n++;
  }
  return n ? [r / n, g / n, b / n] : null;
}

/**
 * Many "opaque" images — logos and product photos alike — are just a
 * flat-colour background (a white/cream studio backdrop, a solid brand-colour
 * card) behind the actual subject. Sample four patches inset from the corners
 * — not the literal edge pixels, which land inside the cut-away area of any
 * rounded corner and would otherwise read as false transparency — and if they
 * agree, key that colour out via a soft alpha threshold instead of leaving
 * the whole frame untouched. Returns null if the corners disagree
 * (photographic/gradient/cluttered background), a corner is genuinely
 * transparent with nothing to sample, or the result is implausible
 * (near-empty or near-solid — i.e. nothing meaningful was actually keyed).
 */
export async function tryAutoKeyFlatBackground(png: Buffer): Promise<Buffer | null> {
  const meta = await sharp(png).metadata();
  const w = meta.width ?? 0, h = meta.height ?? 0;
  if (!w || !h || w < 20 || h < 20) return null;

  const s      = Math.max(4, Math.round(Math.min(w, h) * 0.06));
  const inset  = Math.round(Math.min(w, h) * 0.18); // clears typical rounded-corner radii
  const points: [number, number][] = [
    [inset, inset], [w - inset - s, inset], [inset, h - inset - s], [w - inset - s, h - inset - s],
  ];
  const corners = await Promise.all(
    points.map(([x, y]) =>
      sharp(png).extract({ left: x, top: y, width: s, height: s }).png().toBuffer().then(averageColor),
    ),
  );
  if (corners.some((c) => c === null)) return null; // a corner is genuinely transparent — ambiguous, bail
  const solid = corners as [number, number, number][];
  // Real photography backdrops are almost never perfectly flat — directional
  // light and vignetting mean the four corners will differ somewhat even on a
  // genuinely plain surface. Use their average as the reference colour (not
  // just one corner, which biases toward whichever side happens to be lighter/
  // darker) and allow more disagreement than a studio-perfect synthetic test needs.
  const bg: [number, number, number] = [
    solid.reduce((s, c) => s + c[0], 0) / solid.length,
    solid.reduce((s, c) => s + c[1], 0) / solid.length,
    solid.reduce((s, c) => s + c[2], 0) / solid.length,
  ];
  if (Math.max(...solid.map((c) => colorDist(c, bg))) > 42) return null; // corners genuinely disagree (busy/complex bg)

  // ensureAlpha (not removeAlpha) so pixels that were already transparent — e.g. a
  // rounded corner cut outside the card — stay transparent regardless of colour
  // distance, instead of flattening to black and reading as "far from bg = foreground".
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(w * h);
  const LOW = 26, HIGH = 78; // wider soft band to cover gentle real-world gradients
  for (let i = 0, p = 0; p + 3 < data.length; p += 4, i++) {
    const d = colorDist([data[p], data[p + 1], data[p + 2]], bg);
    const byColor = d <= LOW ? 0 : d >= HIGH ? 255 : Math.round(((d - LOW) / (HIGH - LOW)) * 255);
    alpha[i] = Math.min(byColor, data[p + 3]); // never resurrect a pixel that was already transparent
  }

  // A real mark can legitimately be a small fraction of the canvas (a delicate wordmark
  // on a big colour card) — only reject the extremes: near-zero means the corners'
  // colour matched almost everything (nothing distinguishable found at all); near-total
  // means the "background" colour barely appears anywhere (corner sample was wrong).
  const opaqueRatio = alpha.reduce((sum, v) => sum + (v > 128 ? 1 : 0), 0) / alpha.length;
  if (opaqueRatio < 0.003 || opaqueRatio > 0.95) return null;

  const alphaImg = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(0.5).png().toBuffer();
  const rgbImg   = await sharp(png).removeAlpha().png().toBuffer();
  return sharp(rgbImg).joinChannel(alphaImg).png().toBuffer();
}

/** Fraction of pixels that are essentially fully opaque (alpha > 250). */
export async function opacityRatio(buf: Buffer): Promise<number> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let opaque = 0, total = 0;
  for (let p = 0; p + ch - 1 < data.length; p += ch) { total++; if (data[p + ch - 1] > 250) opaque++; }
  return total ? opaque / total : 1;
}

/**
 * Makes the logo legible on the backdrop. Primary signal is a GPT-4o vision
 * hint (see logoVision.ts) — pixel heuristics alone were repeatedly fooled by
 * real logos (e.g. a rounded-corner colour-card logo has just enough
 * incidental transparency at the corners to look "already fine" even though
 * it has a solid fill and baked-in text). Falls back to the old pixel signal
 * only when no hint is available (OpenAI unreachable, or no logo analysis
 * could run in time):
 *   hint transparent            → unchanged (silhouette only if ink fights the tone)
 *   hint flat_color             → auto-key that colour out (always attempted, not gated on aspect/opacity)
 *   hint complex, or no hint & opaque with un-keyable bg → drawn on a small card
 *   isFullLockup (suppress separate name text) → from hint.hasBakedInText, else aspect ratio
 */
/** Average luminance over a transparent PNG's own opaque ("ink") pixels only. */
async function inkLuminance(png: Buffer): Promise<number> {
  const { data } = await sharp(png).resize(160, 160, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  let opaque = 0, lumSum = 0;
  for (let p = 0; p < data.length; p += 4) {
    const a = data[p + 3];
    if (a < 40) continue;
    opaque++;
    lumSum += (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
  }
  return opaque ? lumSum / opaque : 0.5;
}

/** If the transparent PNG's ink is too close to the backdrop tone to read, recolour it as a flat silhouette. */
async function silhouetteIfFighting(png: Buffer, tone: Tone): Promise<Buffer> {
  const inkLum = await inkLuminance(png);
  const fights = (tone === "dark" && inkLum < 0.45) || (tone === "light" && inkLum > 0.62);
  if (!fights) return png;

  const meta = await sharp(png).metadata();
  const fill = tone === "dark" ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: 22, g: 22, b: 22, alpha: 1 };
  return sharp({ create: { width: meta.width!, height: meta.height!, channels: 4, background: fill } })
    .composite([{ input: png, blend: "dest-in" }])
    .png()
    .toBuffer();
}

export async function prepareLogo(
  logo: Buffer,
  tone: Tone,
  hint?: LogoHint | null,
): Promise<PreparedLogo> {
  const base = sharp(logo).ensureAlpha();
  const png  = await base.png().toBuffer();

  const dims   = await sharp(png).metadata();
  const aspect = (dims.width ?? 1) / (dims.height ?? 1);
  const aspectSuggestsLockup = aspect > 1.6 || aspect < 0.6;
  const isFullLockup = hint ? hint.hasBakedInText : aspectSuggestsLockup;

  const { data, info } = await sharp(png)
    .resize(160, 160, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let opaque = 0;
  const total = info.width * info.height;
  for (let p = 0; p < data.length; p += 4) if (data[p + 3] >= 40) opaque++;
  const transparentRatio = 1 - opaque / total;

  const shouldTryKey  = hint ? hint.backgroundStyle === "flat_color"  : transparentRatio < 0.12;
  const alreadyClean  = hint ? hint.backgroundStyle === "transparent" : transparentRatio >= 0.12;

  if (shouldTryKey) {
    const keyed = await tryAutoKeyFlatBackground(png).catch(() => null);
    if (keyed) return { png: await silhouetteIfFighting(keyed, tone), onCard: false, isFullLockup };
    return { png, onCard: true, isFullLockup: true }; // couldn't clean at all — play it safe
  }

  if (alreadyClean) {
    return { png: await silhouetteIfFighting(png, tone), onCard: false, isFullLockup };
  }

  // hint === "complex" — a photo/gradient/pattern background; not worth attempting to key.
  return { png, onCard: true, isFullLockup };
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
