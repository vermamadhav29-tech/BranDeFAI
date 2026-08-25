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
// Stores whichever path actually registered — readable in every buildTextLayer call.
let _resolvedFontNormal = "(not yet registered)";
let _resolvedFontBold   = "(not yet registered)";

function ensureFonts(log: Logger): void {
  if (_fontsLoaded) return;
  _fontsLoaded = true;

  const tryRegister = (candidates: string[], weight: string) => {
    for (const fp of candidates) {
      const exists = fs.existsSync(fp);
      log(`[compositing/font] weight=${weight} candidate=${fp} exists=${exists}`);
      if (exists) {
        try {
          registerFont(fp, { family: "StudioFont", weight });
          log(`[compositing/font] REGISTERED weight=${weight}: ${fp}`);
          if (weight === "normal") _resolvedFontNormal = fp;
          else                     _resolvedFontBold   = fp;
          return;
        } catch (e) {
          log(`[compositing/font] registerFont THREW for ${fp}: ${String(e)}`);
        }
      }
    }
    log(`[compositing/font] WARNING — no candidate found for weight=${weight}; canvas falls back to system sans-serif`);
    if (weight === "normal") _resolvedFontNormal = "NONE — system fallback";
    else                     _resolvedFontBold   = "NONE — system fallback";
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
  logoBuffer?: Buffer;  // optional — overlaid after main composite, never sent to AI
  text: TextLayerParams;
  log: Logger;
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

// ─── Drop shadow ──────────────────────────────────────────────────────────────
// Creates a pure-black image with the product's alpha at 60% opacity, then
// blurs it. Sharp's .tint({r:0,g:0,b:0}) preserves luminance not colour, so
// we extract the alpha channel manually to guarantee a correctly dark shadow.

async function buildDropShadow(prodBuf: Buffer, blur = 22): Promise<Buffer> {
  const { data, info } = await sharp(prodBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Pure black pixels, alpha = 60% of product alpha
  const pixels = Buffer.alloc(width * height * 4, 0);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 3] = Math.round(Number(data[i * 4 + 3]) * 0.6);
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .blur(blur)
    .png()
    .toBuffer();
}

// ─── Diagnostic helper ────────────────────────────────────────────────────────
// Dumps a string as human-readable text PLUS U+XXXX codepoints so we can see
// whether the string itself is garbled (encoding issue) or the font lacks glyphs.

function diagStr(s: string): string {
  const cps = [...s]
    .map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");
  return `"${s}" [${cps}]`;
}

// ─── Text canvas layer ────────────────────────────────────────────────────────

async function buildTextLayer(p: TextLayerParams, log: Logger): Promise<Buffer> {
  // ── DIAGNOSTIC: which font paths were resolved ────────────────────────────
  log(`[compositing/diag] font-normal resolved path: ${_resolvedFontNormal}`);
  log(`[compositing/diag] font-bold  resolved path: ${_resolvedFontBold}`);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const font = (size: number, weight = "normal") =>
    `${weight} ${size}px StudioFont, sans-serif`;

  // Brand name (top-left)
  const brandStr = p.brandName.toUpperCase();
  log(`[compositing/diag] DRAW brand-name: ${diagStr(brandStr)}`);
  ctx.font = font(22, "bold");
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.fillText(brandStr, 44, 66);

  // Headline — word-wrap at 940px
  ctx.font = font(66, "bold");
  ctx.fillStyle = "#FFFFFF";
  log(`[compositing/diag] DRAW headline (raw): ${diagStr(p.headline)}`);
  const headWords = p.headline.split(" ");
  let lineStr = "";
  let lineY = 445;
  for (const word of headWords) {
    const test = lineStr ? `${lineStr} ${word}` : word;
    if (ctx.measureText(test).width > 940 && lineStr) {
      log(`[compositing/diag] DRAW headline line: ${diagStr(lineStr)}`);
      ctx.fillText(lineStr, 44, lineY);
      lineStr = word;
      lineY += 80;
    } else {
      lineStr = test;
    }
  }
  if (lineStr) {
    log(`[compositing/diag] DRAW headline line: ${diagStr(lineStr)}`);
    ctx.fillText(lineStr, 44, lineY);
    lineY += 80;
  }

  // Subheadline
  log(`[compositing/diag] DRAW subheadline: ${diagStr(p.subheadline)}`);
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

  log(`[compositing/diag] DRAW cta: ${diagStr(p.cta)}`);
  ctx.font = font(15, "bold");
  ctx.fillStyle = p.primaryColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitTextWidth(ctx, p.cta, CTA_W - 24, 15);
  ctx.fillText(p.cta, CTA_X + CTA_W / 2, CTA_Y + CTA_H / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  log("[compositing] text layer drawn — check /diag lines above for strings and font paths");
  return canvas.toBuffer("image/png");
}

// ─── Main compositing entry point ─────────────────────────────────────────────

export async function compositeStudioImage(input: CompositingInput): Promise<Buffer> {
  const { backgroundBuffer, productBuffer, logoBuffer, text, log } = input;

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

  // 3. Product — already a transparent RGBA PNG from BiRefNet background removal.
  //    If bg removal failed upstream, productBuffer is the original photo with
  //    its background intact — it is composited as-is (fallback path).
  //    Cap at 55% W × 62% H to leave background scene visible around the product.
  const PW_MAX = Math.round(W * 0.55);
  const PH_MAX = Math.round(H * 0.62);
  const prodResized = await sharp(productBuffer)
    .resize({ width: PW_MAX, height: PH_MAX, fit: "inside" })
    .toBuffer();
  const pm = await sharp(prodResized).metadata();
  const PW = pm.width  ?? PW_MAX;
  const PH = pm.height ?? PH_MAX;

  // Center horizontally; vertically target product center at ~58% of canvas,
  // clamped so it never starts above 22% or clips into the 92px bottom bar.
  const PAD = 28;
  const prodLeft = Math.round((W - PW) / 2);
  const prodTop = Math.max(
    Math.round(H * 0.22),
    Math.min(
      Math.round(H * 0.58 - PH / 2),
      H - 92 - PH - 20,
    ),
  );

  // 4. Drop shadow — black silhouette at 60% alpha, blurred + offset
  const shadowBuf = await buildDropShadow(prodResized);

  const prodWithShadow = await sharp({
    create: {
      width: PW + PAD * 2,
      height: PH + PAD * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadowBuf, left: PAD + 12, top: PAD + 16, blend: "over" },
      { input: prodResized, left: PAD, top: PAD, blend: "over" },
    ])
    .png()
    .toBuffer();
  log(`[compositing] product+shadow: ${PW}×${PH} at (${prodLeft},${prodTop})`);

  // 5. Text layer
  const textBuf = await buildTextLayer(text, log);
  log("[compositing] text layer built");

  // 6. Final composite: bg → gradient → product → text
  const composites: OverlayOptions[] = [
    { input: grad, left: 0, top: 0 },
    {
      input: prodWithShadow,
      left: Math.max(0, prodLeft - PAD),
      top:  Math.max(0, prodTop  - PAD),
    },
    { input: textBuf, left: 0, top: 0 },
  ];

  const result = await sharp(bg)
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer();

  log(`[compositing] main composite done — ${result.length} bytes`);

  // 7. Optional logo overlay — applied only to composited output, never raw backgrounds.
  // Placed at bottom-right corner, 12% of canvas width, padding preserved.
  // PNG transparency is respected via ensureAlpha() + Sharp's 'over' blend.
  if (logoBuffer) {
    const LOGO_MAX = Math.round(W * 0.12); // ~130 px
    const LOGO_PAD = 20;

    const logoResized = await sharp(logoBuffer)
      .resize({ width: LOGO_MAX, height: LOGO_MAX, fit: "inside" })
      .ensureAlpha()
      .toBuffer();

    const lm = await sharp(logoResized).metadata();
    const lW = lm.width  ?? LOGO_MAX;
    const lH = lm.height ?? LOGO_MAX;

    // Position: above the bottom bar (H − 92) with LOGO_PAD gap from right/bottom edges
    const logoLeft = W - lW - LOGO_PAD;
    const logoTop  = Math.max(0, H - 92 - lH - LOGO_PAD);

    const withLogo = await sharp(result)
      .composite([{ input: logoResized, left: logoLeft, top: logoTop, blend: "over" }])
      .jpeg({ quality: 92 })
      .toBuffer();

    log(`[compositing] logo overlaid ${lW}×${lH} at (${logoLeft},${logoTop}) — ${withLogo.length} bytes`);
    return withLogo;
  }

  return result;
}
