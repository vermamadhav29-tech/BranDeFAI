/**
 * designSystem.ts — the constrained menu the Art Director (GPT-4o) picks from
 * and the deterministic renderer obeys.
 *
 *   fonts        → bundled OFL families in assets/fonts, registered with node-canvas
 *   pairings     → display + body font combos, keyed by mood
 *   layouts      → fixed 1080×1080 regions: brand block, text zone, product zone,
 *                  trust row, sign-off. Regions never overlap → no text/product collisions.
 *   scenes       → per-industry backdrop vocabulary used to pre-render the background library
 *   icons        → Lucide icon ids GPT may choose for trust bullets
 *
 * Reused by the final app — nothing here is studio-test specific.
 */

import fs from "fs";
import path from "path";
import { registerFont } from "canvas";

export const ASSETS_DIR = path.join(__dirname, "..", "..", "assets");
export const CANVAS_W = 1080;
export const CANVAS_H = 1080;

// ─── Fonts ────────────────────────────────────────────────────────────────────

interface FontFile { file: string; weight?: string; style?: string }

const FONT_FAMILIES: Record<string, FontFile[]> = {
  "Playfair Display": [
    { file: "PlayfairDisplay-Regular.ttf" },
    { file: "PlayfairDisplay-Bold.ttf",       weight: "bold" },
    { file: "PlayfairDisplay-Italic.ttf",     style: "italic" },
    { file: "PlayfairDisplay-BoldItalic.ttf", weight: "bold", style: "italic" },
  ],
  "Cormorant Garamond": [
    { file: "CormorantGaramond-Regular.ttf" },
    { file: "CormorantGaramond-SemiBold.ttf", weight: "600" },
    { file: "CormorantGaramond-Bold.ttf",     weight: "bold" },
    { file: "CormorantGaramond-Italic.ttf",   style: "italic" },
  ],
  "DM Serif Display": [
    { file: "DMSerifDisplay-Regular.ttf" },
    { file: "DMSerifDisplay-Italic.ttf", style: "italic" },
  ],
  "Lora": [
    { file: "Lora-Regular.ttf" },
    { file: "Lora-Bold.ttf",   weight: "bold" },
    { file: "Lora-Italic.ttf", style: "italic" },
  ],
  "Inter": [
    { file: "Inter-Regular.ttf" },
    { file: "Inter-SemiBold.ttf", weight: "600" },
    { file: "Inter-Bold.ttf",     weight: "bold" },
  ],
  "Montserrat": [
    { file: "Montserrat-Regular.ttf" },
    { file: "Montserrat-SemiBold.ttf", weight: "600" },
    { file: "Montserrat-Bold.ttf",     weight: "bold" },
  ],
  "Poppins": [
    { file: "Poppins-Regular.ttf" },
    { file: "Poppins-SemiBold.ttf", weight: "600" },
    { file: "Poppins-Bold.ttf",     weight: "bold" },
  ],
  "Nunito": [
    { file: "Nunito-Regular.ttf" },
    { file: "Nunito-Bold.ttf", weight: "bold" },
  ],
  "Noto Sans": [
    { file: "NotoSans-Regular.ttf" },
    { file: "NotoSans-Bold.ttf", weight: "bold" },
  ],
};

let _fontsRegistered = false;

/** Registers every bundled font file that exists on disk. Safe to call repeatedly. */
export function registerAllFonts(log?: (m: string) => void): void {
  if (_fontsRegistered) return;
  const dir = path.join(ASSETS_DIR, "fonts");
  let count = 0;
  for (const [family, files] of Object.entries(FONT_FAMILIES)) {
    for (const f of files) {
      const p = path.join(dir, f.file);
      if (!fs.existsSync(p)) continue;
      try {
        registerFont(p, { family, weight: f.weight ?? "normal", style: f.style ?? "normal" });
        count++;
      } catch (err) {
        const msg = `[fonts] FAILED ${f.file}: ${err instanceof Error ? err.message : String(err)}`;
        (log ?? console.warn)(msg);
      }
    }
  }
  _fontsRegistered = true;
  (log ?? console.log)(`[fonts] registered ${count} font files from ${dir}`);
}

// ─── Font pairings ────────────────────────────────────────────────────────────

export type FontPairingId =
  | "luxury_serif"
  | "refined_serif"
  | "editorial_bold"
  | "classic_editorial"
  | "modern_geometric"
  | "friendly_rounded";

export interface FontPairing {
  display:       string;   // headline / brand wordmark / sign-off
  body:          string;   // subheadline / trust labels
  displayWeight: "bold" | "normal";
  italicAccent:  boolean;  // second headline line in italic
  tracking:      number;   // letter-spacing for the brand wordmark (px)
}

export const FONT_PAIRINGS: Record<FontPairingId, FontPairing> = {
  luxury_serif:      { display: "Playfair Display",   body: "Inter",      displayWeight: "bold",   italicAccent: true,  tracking: 7 },
  refined_serif:     { display: "Cormorant Garamond", body: "Montserrat", displayWeight: "bold",   italicAccent: true,  tracking: 8 },
  editorial_bold:    { display: "DM Serif Display",   body: "Inter",      displayWeight: "normal", italicAccent: true,  tracking: 6 },
  classic_editorial: { display: "Lora",               body: "Nunito",     displayWeight: "bold",   italicAccent: true,  tracking: 5 },
  modern_geometric:  { display: "Montserrat",         body: "Inter",      displayWeight: "bold",   italicAccent: false, tracking: 6 },
  friendly_rounded:  { display: "Poppins",            body: "Nunito",     displayWeight: "bold",   italicAccent: false, tracking: 4 },
};

export const FONT_PAIRING_IDS = Object.keys(FONT_PAIRINGS) as FontPairingId[];

// ─── Layouts ──────────────────────────────────────────────────────────────────

export type LayoutId =
  | "text_left_product_right"
  | "text_right_product_left"
  | "text_top_product_bottom"
  | "centered_hero";

export type Align = "left" | "right" | "center";

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  id:      LayoutId;
  brand:   { x: number; y: number; align: Align; maxLogoH: number };
  text:    Rect & { align: Align };
  product: Rect;
  trust:   { x: number; y: number; w: number; align: Align } | null;
  /** shareTrustRow: signoff sits beside the trust bullets, same visual row —
   *  the renderer computes signoff's max width and y from the trust block's
   *  actual rendered bounds so the two can never collide, regardless of copy length. */
  signoff: { x: number; y: number; align: Align; shareTrustRow?: boolean } | null;
  /** Direction of the legibility gradient laid over the backdrop behind the text zone */
  shade:   "left" | "right" | "top" | "bottom";
}

export const LAYOUTS: Record<LayoutId, Layout> = {
  text_left_product_right: {
    id: "text_left_product_right",
    brand:   { x: 60,  y: 56,  align: "left", maxLogoH: 130 },
    text:    { x: 60,  y: 330, w: 440, h: 440, align: "left" },
    product: { x: 530, y: 140, w: 500, h: 720 },
    trust:   { x: 40,  y: 880, w: 1000, align: "center" },
    signoff: null,
    shade:   "left",
  },
  text_right_product_left: {
    id: "text_right_product_left",
    brand:   { x: 1020, y: 56, align: "right", maxLogoH: 130 },
    text:    { x: 580, y: 330, w: 440, h: 440, align: "right" },
    product: { x: 50,  y: 140, w: 500, h: 720 },
    trust:   { x: 40,  y: 880, w: 1000, align: "center" },
    signoff: null,
    shade:   "right",
  },
  text_top_product_bottom: {
    id: "text_top_product_bottom",
    brand:   { x: 60,  y: 48,  align: "left", maxLogoH: 84 },
    text:    { x: 60,  y: 180, w: 960, h: 230, align: "left" },
    product: { x: 200, y: 420, w: 680, h: 460 },
    trust:   { x: 40,  y: 920, w: 1000, align: "center" },
    signoff: null,
    shade:   "top",
  },
  centered_hero: {
    id: "centered_hero",
    brand:   { x: 540, y: 48,  align: "center", maxLogoH: 96 },
    product: { x: 240, y: 180, w: 600, h: 480 },
    text:    { x: 120, y: 680, w: 840, h: 220, align: "center" },
    trust:   { x: 40,  y: 930, w: 1000, align: "center" },
    signoff: null,
    shade:   "bottom",
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

// ─── Backdrop scenes (used to pre-render the background library) ──────────────

export const INDUSTRY_SCENES: Record<string, Record<string, string>> = {
  jewellery: {
    royal:    "deep royal-blue satin fabric draped in soft luxurious folds, dark surroundings",
    romantic: "blush rose-pink silk fabric with gentle soft folds, warm dreamy light",
    classic:  "black velvet fabric surface with a subtle sheen, dark moody vignette",
    fresh:    "pale white-grey marble slab with soft morning window light, minimal and airy",
    warm:     "champagne-gold silk fabric with soft ripples, golden-hour glow",
    emerald:  "deep emerald-green velvet with soft folds, dark moody studio light",
  },
  food_desserts: {
    rustic:   "dark walnut wooden table with a crumpled linen napkin, warm side light",
    bright:   "white marble kitchen counter with soft daylight, airy and clean",
    moody:    "dark slate stone surface with a light dusting of flour, dramatic side light",
    warm:     "terracotta ceramic surface and warm beige linen, golden light",
  },
  lifestyle: {
    minimal:  "pale grey concrete studio backdrop with a single soft shadow, clean",
    warm:     "light oak wooden surface against a warm plaster wall, golden light",
    urban:    "dark charcoal studio with a single soft spotlight pool, cinematic",
    natural:  "natural linen textile with dried grass stems at the edge, soft daylight",
    heritage: "warm carved wooden shelf with a softly blurred marble backdrop, gentle golden diya-like glow",
  },
};

export function sceneMoodsFor(industry: string): string[] {
  return Object.keys(INDUSTRY_SCENES[industry.toLowerCase()] ?? INDUSTRY_SCENES.lifestyle);
}

export function scenePrompt(sceneDescription: string, variation = ""): string {
  return (
    `Empty product-photography backdrop: ${sceneDescription}${variation}. ` +
    "Cinematic soft studio lighting, gentle vignette, shallow depth of field. " +
    "Completely empty stage — no objects, no products, no props anywhere in the frame. " +
    "Open, uncluttered area across the centre for a product to be placed later. " +
    "Ultra-realistic, 8k, editorial advertising photography."
  );
}

export const SCENE_NEGATIVE =
  "jewellery, ring, necklace, earrings, bracelet, gemstone, product, object, bottle, box, " +
  "plate, food, flowers, text, letters, watermark, logo, hands, people, face, cluttered, busy";

export const SCENE_VARIATIONS = [
  "",
  ", camera slightly elevated looking down at the surface",
  ", tighter crop showing more of the material texture",
];

// ─── Trust-bullet icons (Lucide ids) ──────────────────────────────────────────

export const ICON_IDS = [
  "gem", "diamond", "sparkles", "crown", "award", "medal", "badge-check", "shield-check",
  "circle-check", "heart", "infinity", "star", "gift", "lock", "hand", "hammer", "feather",
  "leaf", "flower-2", "sun", "droplets", "flame", "zap", "recycle", "package", "truck",
  "coffee", "cake", "croissant", "utensils", "wheat",
  "landmark", "hand-heart", "flame-kindling",
] as const;

export type IconId = (typeof ICON_IDS)[number];

export function isIconId(v: unknown): v is IconId {
  return typeof v === "string" && (ICON_IDS as readonly string[]).includes(v);
}
