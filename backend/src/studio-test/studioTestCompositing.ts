/**
 * studioTestCompositing.ts
 *
 * Fully self-contained Sharp + node-canvas compositing module.
 * Imports NOTHING from the existing pipeline. Registers fonts explicitly
 * via __dirname-relative paths so Railway's restricted fontconfig can't
 * cause silent fallbacks to missing system fonts.
 */

import path from "path";
import fs from "fs";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import { createCanvas, registerFont } from "canvas";

// ─── Canvas dimensions ────────────────────────────────────────────────────────

const W = 1080;
const H = 1350;

// ─── Font registration ────────────────────────────────────────────────────────
// Ordered by preference. The __dirname-relative paths allow bundled fonts to
// take priority; system paths installed by nixpacks (fonts-liberation) are
// fallbacks. Whichever file exists first on disk wins.

const FONT_REGULAR_CANDIDATES = [
  // Bundled alongside compiled JS (add font files here for guaranteed availability)
  path.resolve(__dirname, "../../assets/fonts/LiberationSans-Regular.ttf"),
  path.resolve(__dirname, "../assets/fonts/LiberationSans-Regular.ttf"),
  // nixpacks: fonts-liberation
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  // nixpacks: fonts-dejavu-core
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];

const FONT_BOLD_CANDIDATES = [
  path.resolve(__dirname, "../../assets/fonts/LiberationSans-Bold.ttf"),
  path.resolve(__dirname, "../assets/fonts/LiberationSans-Bold.ttf"),
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
];

let _fontsLoaded = false;

function ensureFonts(log: Logger): void {
  if (_fontsLoaded) return;
  _fontsLoaded = true;

  const tryRegister = (candidates: string[], weight: string) => {
    for (const fp of candidates) {
      if (fs.existsSync(fp)) {
        try {
          registerFont(fp, { family: "StudioFont", weight });
          log(`[compositing] font registered weight=${weight}: ${fp}`);
          return;
        } catch (e) {
          log(`[compositing] registerFont failed for ${fp}: ${String(e)}`);
        }
      }
    }
    log(`[compositing] WARNING no font file found for weight=${weight}; canvas will fall back to system sans-serif`);
  };

  tryRegister(FONT_REGULAR_CANDIDATES, "normal");
  tryRegister(FONT_BOLD_CANDIDATES, "bold");
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Logger = (msg: string) => void;

export interface TextLayerParams {
  brandName: string;
  headline: string;
  subheadline: string;
  cta: string;
  primaryColor: string;  // e.g. "#1A7A4A"
  accentColor: string;   // e.g. "#FFD700"
}

export interface CompositingInput {
  backgroundBuffer: Buffer;
  productBuffer: Buffer;
  text: TextLayerParams;
  log: Logger;
}

// ─── White background removal ─────────────────────────────────────────────────

async function removeWhiteBg(buf: Buffer, threshold = 228): Promise<Buffer> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] > threshold && px[i + 1] > threshold && px[i + 2] > threshold) {
      px[i + 3] = 0;
    }
  }

  return sharp(px, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

type Ctx2D = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

function rrect(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
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

function fitTextWidth(
  ctx: Ctx2D,
  text: string,
  maxPx: number,
  startSize: number,
  minSize = 24,
): number {
  let size = startSize;
  while (size > minSize && ctx.measureText(text).width > maxPx) {
    size -= 2;
    ctx.font = ctx.font.replace(/\d+px/, `${size}px`);
  }
  return size;
}

// ─── Text canvas layer ────────────────────────────────────────────────────────

async function buildTextLayer(p: TextLayerParams, log: Logger): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const font = (size: number, weight = "normal") =>
    `${weight} ${size}px StudioFont, sans-serif`;

  // Brand name (top-left)
  ctx.font = font(22, "bold");
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.fillText(p.brandName.toUpperCase(), 44, 66);
  log("[compositing] text: brand name");

  // Headline — word-wrap at 940px
  ctx.font = font(66, "bold");
  ctx.fillStyle = "#FFFFFF";
  const headWords = p.headline.split(" ");
  let lineStr = "";
  let lineY = 445;
  for (const word of headWords) {
    const test = lineStr ? `${lineStr} ${word}` : word;
    if (ctx.measureText(test).width > 940 && lineStr) {
      ctx.fillText(lineStr, 44, lineY);
      lineStr = word;
      lineY += 80;
    } else {
      lineStr = test;
    }
  }
  if (lineStr) {
    ctx.fillText(lineStr, 44, lineY);
    lineY += 80;
  }
  log(`[compositing] text: headline (endY=${lineY})`);

  // Subheadline
  ctx.font = font(23);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(p.subheadline, 44, lineY + 12);

  // Accent divider
  ctx.strokeStyle = p.accentColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(44, lineY + 42);
  ctx.lineTo(200, lineY + 42);
  ctx.stroke();

  // Bottom bar
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = p.primaryColor;
  ctx.fillRect(0, H - 92, W, 92);
  ctx.globalAlpha = 1;

  // CTA pill
  const CTA_W = 196;
  const CTA_H = 50;
  const CTA_X = W - CTA_W - 44;
  const CTA_Y = H - 92 + 21;
  rrect(ctx, CTA_X, CTA_Y, CTA_W, CTA_H, 25);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.font = font(15, "bold");
  ctx.fillStyle = p.primaryColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitTextWidth(ctx, p.cta, CTA_W - 24, 15);
  ctx.fillText(p.cta, CTA_X + CTA_W / 2, CTA_Y + CTA_H / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  log("[compositing] text: CTA drawn");
  return canvas.toBuffer("image/png");
}

// ─── Main compositing entry point ─────────────────────────────────────────────

export async function compositeStudioImage(input: CompositingInput): Promise<Buffer> {
  const { backgroundBuffer, productBuffer, text, log } = input;

  ensureFonts(log);

  // 1. Resize background
  const bg = await sharp(backgroundBuffer)
    .resize(W, H, { fit: "cover", position: "center" })
    .toBuffer();
  log(`[compositing] bg resized to ${W}×${H}`);

  // 2. Gradient overlay SVG
  const grad = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stop-color="black" stop-opacity="0.70"/>
          <stop offset="52%"  stop-color="black" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.04"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
    </svg>`,
  );

  // 3. Product — remove white background if present
  const stats = await sharp(productBuffer).stats();
  const isWhiteBg =
    stats.channels[0].mean > 220 &&
    stats.channels[1].mean > 220 &&
    stats.channels[2].mean > 220;
  const cleanProd = isWhiteBg ? await removeWhiteBg(productBuffer) : productBuffer;
  log(`[compositing] product whiteBg=${isWhiteBg}`);

  const PW = Math.round(W * 0.43);
  const prodResized = await sharp(cleanProd).resize({ width: PW }).toBuffer();
  const pm = await sharp(prodResized).metadata();
  const PH = pm.height ?? PW;

  // Right-center placement, slightly raised
  const PAD = 28;
  const prodLeft = Math.round(W * 0.49);
  const prodTop = Math.max(0, Math.round((H * 0.85 - PH) / 2));

  // 4. Drop shadow
  const shadowBuf = await sharp(prodResized)
    .ensureAlpha()
    .tint({ r: 0, g: 0, b: 0 })
    .blur(20)
    .toBuffer();

  const prodWithShadow = await sharp({
    create: {
      width: PW + PAD * 2,
      height: PH + PAD * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadowBuf, left: PAD + 5, top: PAD + 8, blend: "multiply" },
      { input: prodResized, left: PAD, top: PAD },
    ])
    .png()
    .toBuffer();
  log(`[compositing] product+shadow: ${PW}×${PH}`);

  // 5. Text layer
  const textBuf = await buildTextLayer(text, log);
  log("[compositing] text layer built");

  // 6. Final composite: bg → gradient → product → text
  const composites: OverlayOptions[] = [
    { input: grad, left: 0, top: 0 },
    {
      input: prodWithShadow,
      left: Math.max(0, prodLeft - PAD),
      top: Math.max(0, prodTop - PAD),
    },
    { input: textBuf, left: 0, top: 0 },
  ];

  const result = await sharp(bg)
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer();

  log(`[compositing] done — ${result.length} bytes`);
  return result;
}
