/**
 * backgroundLibrary.ts — pre-rendered "empty stage" backdrops.
 *
 * The library is generated once by scripts/generateBackgrounds.ts (Flux → Cloudinary)
 * and described by assets/backgrounds/manifest.json. At request time we only pick
 * an entry and download it — zero generation cost, deterministic quality.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { ASSETS_DIR, CANVAS_W, CANVAS_H } from "./designSystem";

export interface BackgroundItem {
  id:       string;
  industry: string;
  mood:     string;
  url:      string;
  tone:     "dark" | "light";
  dominant: string;   // hex
}

export interface BackgroundManifest {
  generatedAt: string;
  items:       BackgroundItem[];
}

export const MANIFEST_PATH = path.join(ASSETS_DIR, "backgrounds", "manifest.json");

let _manifest: BackgroundManifest | null = null;

export function loadManifest(): BackgroundManifest {
  if (_manifest) return _manifest;
  try {
    _manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as BackgroundManifest;
  } catch (_) {
    _manifest = { generatedAt: "", items: [] };
  }
  return _manifest;
}

/** Picks a backdrop for industry + mood; falls back to any mood in the industry; null if none. */
export function pickBackground(
  industry: string,
  mood: string | undefined,
  excludeId?: string,
): BackgroundItem | null {
  const items = loadManifest().items;
  const ind   = industry.toLowerCase();

  let pool = items.filter((i) => i.industry === ind && (!mood || i.mood === mood));
  if (pool.length === 0) pool = items.filter((i) => i.industry === ind);
  if (pool.length === 0) return null;

  const notLast = pool.filter((i) => i.id !== excludeId);
  const final   = notLast.length > 0 ? notLast : pool;
  return final[Math.floor(Math.random() * final.length)];
}

const _cache = new Map<string, Buffer>();

/** Downloads (and memoises) the backdrop, resized to the canvas. */
export async function fetchBackground(item: BackgroundItem): Promise<Buffer> {
  const hit = _cache.get(item.id);
  if (hit) return hit;

  const res = await fetch(item.url);
  if (!res.ok) throw new Error(`background download HTTP ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());

  const buf = await sharp(raw)
    .resize(CANVAS_W, CANVAS_H, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  _cache.set(item.id, buf);
  return buf;
}

/** Utility shared with the generator: dominant colour + tone from an image buffer. */
export async function analyseTone(buf: Buffer): Promise<{ dominant: string; tone: "dark" | "light" }> {
  const { dominant } = await sharp(buf).stats();
  const lum = (0.299 * dominant.r + 0.587 * dominant.g + 0.114 * dominant.b) / 255;
  const hex = "#" + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return { dominant: hex, tone: lum < 0.5 ? "dark" : "light" };
}
