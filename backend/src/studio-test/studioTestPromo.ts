/**
 * studioTestPromo.ts
 *
 * Builds a 1080×1080 Instagram promo post from the product photo alone.
 * No AI image generation — backdrop is the original photo blurred + darkened,
 * foreground is the BiRefNet transparent cutout.
 *
 * Self-contained: imports NOTHING from the existing service pipeline.
 */

import sharp from "sharp";

type Logger = (msg: string) => void;

const W = 1080;
const H = 1080;

export interface PromoInput {
  productBuffer: Buffer;   // original photo — used as the blurred backdrop
  cutoutBuffer:  Buffer;   // BiRefNet transparent cutout (or original fallback)
  logoBuffer?:   Buffer;
  brandName:     string;
  brandTagline:  string;   // e.g. "Har rishta, ek naya ehsaas"
  headline:      string;   // from analyzeCreative (3-7 words)
  subheadline:   string;   // from analyzeCreative (1 sentence)
  cta:           string;   // from analyzeCreative (2-3 words)
  trustBullets:  string[]; // from analyzeCreative (max 4)
  primaryColor:  string;   // hex
  accentColor:   string;   // hex
  postType:      "lifestyle" | "product_highlight";
  log:           Logger;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function xe(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").padEnd(6, "0");
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

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

// Returns the inner SVG content (no <svg> wrapper) for a trust bullet icon.
// Coordinates are relative to a 20×20 viewBox — caller wraps in a <g transform="translate(x,y)">.
function getIconPath(bullet: string, color: string): string {
  const low = bullet.toLowerCase();
  const c = xe(color);

  if (/diamond|certified|real/.test(low)) {
    return `<polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="${c}" stroke-width="1.5"/>`;
  }
  if (/gold|hallmark|karat|\bkt\b/.test(low)) {
    return `<circle cx="10" cy="10" r="7" fill="none" stroke="${c}" stroke-width="2"/>`;
  }
  if (/gift|gifting|luxury/.test(low)) {
    return (
      `<rect x="3" y="8" width="14" height="10" rx="1" fill="none" stroke="${c}" stroke-width="1.5"/>` +
      `<line x1="10" y1="8" x2="10" y2="18" stroke="${c}" stroke-width="1.5"/>` +
      `<path d="M10 8 C10 8 7 3 4 5 C2 7 7 8 10 8" fill="none" stroke="${c}" stroke-width="1.5"/>` +
      `<path d="M10 8 C10 8 13 3 16 5 C18 7 13 8 10 8" fill="none" stroke="${c}" stroke-width="1.5"/>`
    );
  }
  if (/skin|hypoallergenic|safe/.test(low)) {
    return `<path d="M10 2 L17 5 L17 11 C17 15 10 19 10 19 C10 19 3 15 3 11 L3 5 Z" fill="none" stroke="${c}" stroke-width="1.5"/>`;
  }
  if (/craft|handcraft|made/.test(low)) {
    return `<path d="M7 12 L5 8 Q4 6 6 6 Q7 6 7 8 L7 6 Q7 4 9 4 Q11 4 11 6 L11 5 Q11 3 13 3 Q15 3 15 5 L15 7 Q15 6 16 6 Q18 6 18 8 L18 14 Q18 18 14 18 L9 18 Q6 18 5 15" fill="none" stroke="${c}" stroke-width="1.5"/>`;
  }
  // default — sparkle/star
  return `<polygon points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8" fill="${c}" opacity="0.9"/>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function buildPromoPost(input: PromoInput): Promise<Buffer> {
  const {
    productBuffer, cutoutBuffer, logoBuffer,
    brandName, brandTagline, headline, subheadline, cta,
    trustBullets, primaryColor, accentColor, postType, log,
  } = input;

  const ac = hexToRgb(accentColor);
  const pc = hexToRgb(primaryColor);
  const acRgb = `rgb(${ac.r},${ac.g},${ac.b})`;
  const pcRgb = `rgb(${pc.r},${pc.g},${pc.b})`;

  // ── 1. Blurred + darkened backdrop ────────────────────────────────────────
  log("[promo] building blurred backdrop...");
  const darkSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="rgba(0,0,0,0.45)"/>` +
    `</svg>`,
  );

  const backdrop = await sharp(productBuffer)
    .resize(W, H, { fit: "cover", position: "centre" })
    .blur(35)
    .composite([{ input: darkSvg, blend: "over" }])
    .png()
    .toBuffer();

  // ── 2. Scale cutout to fit 520×520 ────────────────────────────────────────
  log("[promo] scaling cutout...");
  const meta = await sharp(cutoutBuffer).metadata();
  const cW = meta.width ?? 520;
  const cH = meta.height ?? 520;
  const scale = Math.min(520 / cW, 520 / cH, 1);
  const scaledW = Math.round(cW * scale);
  const scaledH = Math.round(cH * scale);

  const cutoutResized = await sharp(cutoutBuffer)
    .resize(scaledW, scaledH)
    .png()
    .toBuffer();

  // Position: horizontal center at 65% of width, vertical center at 50%
  const cutLeft = Math.max(0, Math.round(W * 0.65 - scaledW / 2));
  const cutTop  = Math.max(0, Math.round(H * 0.50 - scaledH / 2));
  log(`[promo] cutout ${scaledW}×${scaledH} at (${cutLeft},${cutTop})`);

  // ── 3. Composite cutout on backdrop ───────────────────────────────────────
  let canvas = await sharp(backdrop)
    .composite([{ input: cutoutResized, left: cutLeft, top: cutTop, blend: "over" }])
    .png()
    .toBuffer();

  // ── 4. Left-heavy gradient overlay ────────────────────────────────────────
  const gradSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0%"   stop-color="rgba(0,0,0,0.78)"/>` +
    `<stop offset="50%"  stop-color="rgba(0,0,0,0.30)"/>` +
    `<stop offset="100%" stop-color="rgba(0,0,0,0.05)"/>` +
    `</linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/>` +
    `</svg>`,
  );

  canvas = await sharp(canvas)
    .composite([{ input: gradSvg, blend: "over" }])
    .png()
    .toBuffer();

  // ── 5. Build text + UI overlay ────────────────────────────────────────────
  log("[promo] building text overlay...");

  const [hl1, hl2] = splitHeadline(headline);
  const subLines   = wrapText(subheadline, 36);

  // Logo circle
  const logoCircleX = 80;
  const logoCircleY = 80;
  let logoCircleSvg =
    `<circle cx="${logoCircleX}" cy="${logoCircleY}" r="44" fill="white"/>`;
  if (!logoBuffer) {
    const initials = brandName
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
    logoCircleSvg +=
      `<text x="${logoCircleX}" y="${logoCircleY + 8}" ` +
      `font-family="sans-serif" font-size="22" font-weight="bold" ` +
      `fill="${xe(pcRgb)}" text-anchor="middle">${xe(initials)}</text>`;
  }

  // Subheadline lines
  const subSvg = subLines
    .map(
      (l, i) =>
        `<text x="44" y="${530 + i * 30}" ` +
        `font-family="sans-serif" font-size="21" fill="rgba(255,255,255,0.78)">${xe(l)}</text>`,
    )
    .join("");

  // Trust bar
  const hasTrust   = trustBullets.length > 0;
  const trustBarH  = 88;
  const trustBarY  = H - trustBarH;
  let trustSvg = "";
  if (hasTrust) {
    const bullets     = trustBullets.slice(0, 4);
    const sectionW    = Math.floor((W - 80) / bullets.length);
    trustSvg += `<rect x="0" y="${trustBarY}" width="${W}" height="${trustBarH}" fill="rgba(0,0,0,0.72)"/>`;

    bullets.forEach((bullet, i) => {
      const sX      = 40 + i * sectionW;
      const iconY   = trustBarY + Math.round((trustBarH - 20) / 2);
      const textY   = trustBarY + Math.round(trustBarH / 2) + 5;

      if (i > 0) {
        trustSvg +=
          `<line x1="${sX - 10}" y1="${trustBarY + 18}" x2="${sX - 10}" y2="${trustBarY + trustBarH - 18}" ` +
          `stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`;
      }
      trustSvg +=
        `<g transform="translate(${sX},${iconY})">${getIconPath(bullet, accentColor)}</g>`;
      trustSvg +=
        `<text x="${sX + 26}" y="${textY}" ` +
        `font-family="sans-serif" font-size="12" fill="white">${xe(bullet)}</text>`;
    });

    trustSvg +=
      `<text x="${W - 30}" y="${trustBarY + Math.round(trustBarH / 2) + 5}" ` +
      `font-family="sans-serif" font-size="12" fill="rgba(255,255,255,0.6)" ` +
      `font-style="italic" text-anchor="end">${xe(brandTagline)}</text>`;
  }

  // CTA button (product_highlight only)
  const hasCta  = postType === "product_highlight";
  const ctaBtnW = 180;
  const ctaBtnH = 46;
  const ctaX    = W - ctaBtnW - 40;
  const ctaY    = hasTrust ? trustBarY - ctaBtnH - 20 : H - ctaBtnH - 30;
  let ctaSvg = "";
  if (hasCta) {
    ctaSvg =
      `<rect x="${ctaX}" y="${ctaY}" width="${ctaBtnW}" height="${ctaBtnH}" rx="23" fill="white"/>` +
      `<text x="${ctaX + ctaBtnW / 2}" y="${ctaY + ctaBtnH / 2 + 5}" ` +
      `font-family="sans-serif" font-size="14" font-weight="bold" ` +
      `fill="${xe(pcRgb)}" text-anchor="middle">${xe(cta)} →</text>`;
  }

  const overlaySvgStr =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    logoCircleSvg +
    `<text x="36" y="148" font-family="sans-serif" font-size="12" ` +
    `font-style="italic" fill="rgba(255,255,255,0.6)">${xe(brandTagline)}</text>` +
    `<text x="44" y="390" font-family="sans-serif" font-size="68" font-weight="bold" fill="white">${xe(hl1)}</text>` +
    (hl2
      ? `<text x="44" y="468" font-family="sans-serif" font-size="68" ` +
        `font-weight="bold" font-style="italic" fill="${xe(acRgb)}">${xe(hl2)}</text>`
      : "") +
    `<rect x="44" y="488" width="64" height="3" fill="${xe(acRgb)}"/>` +
    subSvg +
    trustSvg +
    ctaSvg +
    `</svg>`;

  const overlaySvg = Buffer.from(overlaySvgStr);

  canvas = await sharp(canvas)
    .composite([{ input: overlaySvg, blend: "over" }])
    .png()
    .toBuffer();

  // ── 6. Composite logo image (if provided) ─────────────────────────────────
  if (logoBuffer) {
    log("[promo] compositing logo image...");
    const logoResized = await sharp(logoBuffer)
      .resize(60, 60, { fit: "inside" })
      .png()
      .toBuffer();
    const logoMeta = await sharp(logoResized).metadata();
    const lLeft = logoCircleX - Math.round((logoMeta.width  ?? 60) / 2);
    const lTop  = logoCircleY - Math.round((logoMeta.height ?? 60) / 2);
    canvas = await sharp(canvas)
      .composite([{ input: logoResized, left: lLeft, top: lTop, blend: "over" }])
      .png()
      .toBuffer();
  }

  // ── 7. JPEG output ────────────────────────────────────────────────────────
  log("[promo] encoding 1080×1080 JPEG...");
  const result = await sharp(canvas)
    .jpeg({ quality: 92 })
    .toBuffer();

  log(`[promo] done — ${result.length} bytes`);
  return result;
}
