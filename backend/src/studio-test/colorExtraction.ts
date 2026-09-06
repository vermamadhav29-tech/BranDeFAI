/**
 * colorExtraction.ts — derives a primary/accent colour pair from the brand's
 * own assets (logo ink, or the product itself) instead of a manual picker.
 *
 * Most real logos are monochrome line art (black/white), which carries no
 * usable hue — in that case we fall back to the product's dominant colour
 * (gold, silver, gemstone tone, ingredient colour, material colour...).
 * If neither has a confident colour, we fall back to a neutral default.
 */

import sharp from "sharp";

type Logger = (msg: string) => void;

export interface DerivedColors {
  primary: string;
  accent:  string;
  source:  "logo" | "product" | "default";
}

const DEFAULT_PRIMARY = "#1A1A1A";
const DEFAULT_ACCENT  = "#C9A24B"; // warm gold — reads well on the dark backdrops this pipeline favours

// ─── colour space helpers ───────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Shifts hue ~35° warm and pushes saturation/lightness so the result reads as a bright accent on a dark backdrop. */
function accentFrom([r, g, b]: [number, number, number]): string {
  const [h, s] = rgbToHsl(r, g, b);
  const newH = (h + 35 / 360) % 1;
  const newS = Math.min(1, s + 0.18);
  return rgbToHex(hslToRgb(newH, newS, 0.62));
}

// ─── dominant "ink" colour ──────────────────────────────────────────────────

/**
 * Average colour over pixels that are opaque and meaningfully saturated —
 * skips background fill, near-white/near-black, and greys. Returns null
 * when there aren't enough such pixels to trust the result (monochrome art).
 */
async function dominantInkColor(buf: Buffer): Promise<{ color: [number, number, number] | null; coverage: number }> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .resize(140, 140, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  let sr = 0, sg = 0, sb = 0, n = 0, total = 0;
  for (let p = 0; p + ch - 1 < data.length; p += ch) {
    total++;
    const a = ch === 4 ? data[p + 3] : 255;
    if (a < 100) continue;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const [, s, l] = rgbToHsl(r, g, b);
    if (s < 0.18 || l < 0.10 || l > 0.92) continue; // skip neutrals / near-black / near-white
    sr += r; sg += g; sb += b; n++;
  }

  if (n < 10 || total === 0) return { color: null, coverage: 0 };
  return { color: [sr / n, sg / n, sb / n], coverage: n / total };
}

// ─── public ───────────────────────────────────────────────────────────────────

export async function deriveBrandColors(
  logoBuffer: Buffer | undefined,
  productBuffer: Buffer,
  log: Logger,
): Promise<DerivedColors> {
  if (logoBuffer) {
    try {
      const { color, coverage } = await dominantInkColor(logoBuffer);
      if (color) {
        const primary = rgbToHex(color);
        const accent  = accentFrom(color);
        log(`[colors] from logo — primary=${primary} accent=${accent} (coverage=${(coverage * 100).toFixed(1)}%)`);
        return { primary, accent, source: "logo" };
      }
      log("[colors] logo has no confident colour (monochrome/neutral) — trying product");
    } catch (err) {
      log(`[colors] logo colour read failed: ${err instanceof Error ? err.message : String(err)} — trying product`);
    }
  }

  try {
    const { color, coverage } = await dominantInkColor(productBuffer);
    if (color) {
      const primary = rgbToHex(color);
      const accent  = accentFrom(color);
      log(`[colors] from product — primary=${primary} accent=${accent} (coverage=${(coverage * 100).toFixed(1)}%)`);
      return { primary, accent, source: "product" };
    }
  } catch (err) {
    log(`[colors] product colour read failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  log(`[colors] no confident colour anywhere — using default ${DEFAULT_PRIMARY}/${DEFAULT_ACCENT}`);
  return { primary: DEFAULT_PRIMARY, accent: DEFAULT_ACCENT, source: "default" };
}
