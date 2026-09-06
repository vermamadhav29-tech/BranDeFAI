/**
 * studioTestPromo.ts — deterministic renderer.
 *
 * Takes the Art Director's choices (layout, font pairing, copy, icons) plus the
 * pre-rendered backdrop and product cutout, and composes a 1080×1080 post.
 * Regions come from designSystem.LAYOUTS so text and product never collide;
 * typeEngine fits every string into its region.
 */

import sharp from "sharp";
import { createCanvas, loadImage } from "canvas";
import {
  registerAllFonts, LAYOUTS, FONT_PAIRINGS, CANVAS_W as W, CANVAS_H as H,
  type LayoutId, type FontPairingId, type Align,
} from "./designSystem";
import { fitText, drawLines, drawTracked, measureTracked, type Ctx2D, type FitResult } from "./typeEngine";
import {
  buildPremiumBackdrop, buildShadowLayer, shadeSvg, spotlightSvg,
  renderIcon, prepareLogo, refineCutout, roundRect, resolveAccent, type Tone,
} from "./studioTestAssets";

registerAllFonts();

type Logger = (msg: string) => void;

export interface PromoInput {
  productBuffer:     Buffer;          // original photo (fallback backdrop source)
  cutoutBuffer:      Buffer;          // BiRefNet transparent PNG
  logoBuffer?:       Buffer;
  backgroundBuffer?: Buffer;          // library backdrop, already 1080×1080
  backgroundTone:    Tone;
  brandName:         string;
  brandTagline:      string;
  headline:          string;
  accentLine:        string;          // optional italic second line
  subheadline:       string;
  cta:               string;          // kept for captions; not rendered
  trustBullets:      string[];        // ≤3
  trustIcons:        string[];        // Lucide ids, parallel to trustBullets
  primaryColor:      string;
  accentColor:       string;
  layoutId:          LayoutId;
  fontPairingId:     FontPairingId;
  log:               Logger;
}

export async function buildPromoPost(i: PromoInput): Promise<Buffer> {
  const L = LAYOUTS[i.layoutId] ?? LAYOUTS.text_left_product_right;
  const P = FONT_PAIRINGS[i.fontPairingId] ?? FONT_PAIRINGS.luxury_serif;
  const tone: Tone = i.backgroundBuffer ? i.backgroundTone : "dark";

  const textCol  = tone === "dark" ? "#FFFFFF" : "#161616";
  const mutedCol = tone === "dark" ? "rgba(255,255,255,0.76)" : "rgba(0,0,0,0.68)";
  const hairCol  = tone === "dark" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)";
  const accent   = resolveAccent(i.accentColor, i.primaryColor, tone);

  const dFont = (size: number, italic = false, weight: "bold" | "normal" | "600" = P.displayWeight) =>
    `${italic ? "italic " : ""}${weight === "normal" ? "" : `${weight} `}${size}px "${P.display}"`;
  const bFont = (size: number, weight: "bold" | "normal" | "600" = "normal") =>
    `${weight === "normal" ? "" : `${weight} `}${size}px "${P.body}"`;

  i.log(`[promo] layout=${L.id} fonts=${P.display}/${P.body} tone=${tone} accent=${accent}`);

  // ── 1. Refine + fit product into its region ──────────────────────────────────
  // refineCutout erodes BiRefNet's colour-contaminated edge pixels before anything
  // else touches the cutout, so the resize/shadow/composite steps all use clean edges.
  const refinedCutout = await refineCutout(i.cutoutBuffer, i.log);
  const meta   = await sharp(refinedCutout).metadata();
  const cW     = meta.width  ?? 600;
  const cH     = meta.height ?? 600;
  const scale  = Math.min(L.product.w / cW, L.product.h / cH);
  const pw     = Math.max(1, Math.round(cW * scale));
  const ph     = Math.max(1, Math.round(cH * scale));
  const px     = Math.round(L.product.x + (L.product.w - pw) / 2);
  const py     = Math.round(L.product.y + (L.product.h - ph) / 2);
  const pcx    = px + pw / 2;
  const pcy    = py + ph / 2;
  const cutout = await sharp(refinedCutout).resize(pw, ph).png().toBuffer();
  i.log(`[promo] product ${pw}×${ph} at (${px},${py})`);

  // ── 2. Backdrop + legibility shade + spotlight ─────────────────────────────
  let canvas = i.backgroundBuffer
    ?? await buildPremiumBackdrop(i.productBuffer, W, H, i.primaryColor, pcx, pcy);

  const overlays: sharp.OverlayOptions[] = [{ input: shadeSvg(W, H, L.shade, tone), blend: "over" }];
  if (tone === "dark") {
    overlays.push({ input: spotlightSvg(W, H, pcx, pcy, Math.max(pw, ph) * 0.78, 0.16), blend: "screen" });
  }
  canvas = await sharp(canvas).composite(overlays).png().toBuffer();

  // ── 3. Contact shadow + product ────────────────────────────────────────────
  const shadow = await buildShadowLayer(cutout, pw, ph, px, py, W, H, tone);
  canvas = await sharp(canvas)
    .composite([
      { input: shadow, blend: "over" },
      { input: cutout, left: px, top: py, blend: "over" },
    ])
    .png()
    .toBuffer();

  // ── 4. Typography layer ────────────────────────────────────────────────────
  const nc  = createCanvas(W, H);
  const ctx = nc.getContext("2d") as Ctx2D;

  const setShadow = (on: boolean) => {
    ctx.shadowColor = on && tone === "dark" ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)";
    ctx.shadowBlur  = on && tone === "dark" ? 10 : 0;
  };

  // Brand block ---------------------------------------------------------------
  const B      = L.brand;
  let   by     = B.y;
  let   hasLogo = false;
  // A logo we couldn't clean (opaque, no auto-keyable flat background) is drawn
  // as-is on a card — that almost always means it's a full lockup with the brand
  // name already baked into the image, so drawing the name again is redundant.
  let   suppressName = false;

  if (i.logoBuffer) {
    try {
      const { png, onCard, isFullLockup } = await prepareLogo(i.logoBuffer, tone);
      const img  = await loadImage(png);
      const s    = Math.min(260 / img.width, B.maxLogoH / img.height);
      const lw   = img.width * s;
      const lh   = img.height * s;
      const lx   = B.align === "left" ? B.x : B.align === "right" ? B.x - lw : B.x - lw / 2;
      if (onCard) {
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        roundRect(ctx, lx - 10, by - 10, lw + 20, lh + 20, 10);
        ctx.fill();
      }
      ctx.drawImage(img, lx, by, lw, lh);
      by += lh + 18;
      hasLogo = true;
      suppressName = isFullLockup;
    } catch (e) {
      i.log(`[promo] logo failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (!suppressName) {
    setShadow(true);
    const name     = i.brandName.toUpperCase();
    let   nameSize = hasLogo ? 26 : 40;
    let   tracking = P.tracking;
    ctx.fillStyle    = textCol;
    ctx.textBaseline = "top";
    ctx.font         = dFont(nameSize);
    while (measureTracked(ctx, name, tracking) > 320 && (tracking > 1 || nameSize > 20)) {
      if (tracking > 1) tracking -= 1; else { nameSize -= 1; ctx.font = dFont(nameSize); }
    }
    drawTracked(ctx, name, B.x, by, tracking, B.align);
    by += nameSize + 8;

    if (!L.signoff && i.brandTagline) {
      ctx.fillStyle = accent;
      ctx.font      = dFont(18, P.italicAccent, "normal");
      ctx.textAlign = B.align;
      ctx.fillText(i.brandTagline, B.x, by);
    }
  }

  // Text block ------------------------------------------------------------------
  const T  = L.text;
  const tx = T.align === "left" ? T.x : T.align === "right" ? T.x + T.w : T.x + T.w / 2;

  const hl = fitText(ctx, i.headline, {
    fontFor: (s) => dFont(s), maxSize: 92, minSize: 52, maxW: T.w, maxLines: 2, lineHeight: 1.04,
  });
  let acc: FitResult | null = null;
  if (i.accentLine.trim()) {
    acc = fitText(ctx, i.accentLine.trim(), {
      fontFor: (s) => dFont(s, P.italicAccent), maxSize: hl.size, minSize: 44, maxW: T.w, maxLines: 1, lineHeight: 1.04,
    });
  }
  const sub = fitText(ctx, i.subheadline, {
    fontFor: (s) => bFont(s), maxSize: 26, minSize: 19, maxW: T.w, maxLines: 3, lineHeight: 1.38,
  });

  const gapRule = 22, ruleH = 3, gapSub = 24, ruleW = 56;
  const blockH  = hl.totalH + (acc?.totalH ?? 0) + gapRule + ruleH + gapSub + sub.totalH;
  let   y       = T.y + Math.max(0, (T.h - blockH) / 2);

  ctx.fillStyle = textCol;
  ctx.font      = dFont(hl.size);
  y = drawLines(ctx, hl.lines, tx, y, hl.lineH, T.align);

  if (acc) {
    ctx.fillStyle = accent;
    ctx.font      = dFont(acc.size, P.italicAccent);
    y = drawLines(ctx, acc.lines, tx, y, acc.lineH, T.align);
  }

  y += gapRule;
  const rx = T.align === "left" ? tx : T.align === "right" ? tx - ruleW : tx - ruleW / 2;
  ctx.fillStyle = accent;
  ctx.fillRect(rx, y, ruleW, ruleH);
  y += ruleH + gapSub;

  ctx.fillStyle = mutedCol;
  ctx.font      = bFont(sub.size);
  drawLines(ctx, sub.lines, tx, y, sub.lineH, T.align);

  // Trust row -------------------------------------------------------------------
  const bullets = i.trustBullets.filter(Boolean).slice(0, 3);
  // Captures the trust block's actual rendered bounds so the sign-off (drawn next)
  // can size and position itself against reality instead of guessed constants.
  let trustBounds: { left: number; right: number; centerY: number } | null = null;

  if (L.trust && bullets.length > 0) {
    const R      = L.trust;
    const n      = bullets.length;
    const colW   = R.align === "center" ? R.w / n : Math.min(196, R.w / n);
    const startX = R.align === "center" ? R.x + (R.w - colW * n) / 2 : R.x;
    const iconSz = 30;
    const labelTopY = R.y + iconSz + 12;

    const labelFits = bullets.map((b) =>
      fitText(ctx, b, {
        fontFor: (s) => bFont(s, "600"), maxSize: 16, minSize: 13, maxW: colW - 24, maxLines: 2, lineHeight: 1.25,
      }),
    );

    for (let k = 0; k < n; k++) {
      const cx = startX + colW * k + colW / 2;

      if (k > 0) {
        ctx.strokeStyle = hairCol;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(startX + colW * k, R.y + 4);
        ctx.lineTo(startX + colW * k, R.y + 86);
        ctx.stroke();
      }

      const iconPng = (await renderIcon(i.trustIcons[k] ?? "sparkles", iconSz, accent))
                   ?? (await renderIcon("sparkles", iconSz, accent));
      if (iconPng) {
        const im = await loadImage(iconPng);
        ctx.drawImage(im, cx - iconSz / 2, R.y, iconSz, iconSz);
      }

      ctx.fillStyle = textCol;
      ctx.font      = bFont(labelFits[k].size, "600");
      drawLines(ctx, labelFits[k].lines, cx, labelTopY, labelFits[k].lineH, "center");
    }

    let blockBottom = labelTopY;
    for (const lab of labelFits) blockBottom = Math.max(blockBottom, labelTopY + lab.totalH);
    trustBounds = { left: startX, right: startX + colW * n, centerY: (R.y + blockBottom) / 2 };
  }

  // Sign-off --------------------------------------------------------------------
  if (L.signoff) {
    const S        = L.signoff;
    const brandStr = `${i.brandName}.`;
    const tag      = i.brandTagline.trim();
    const GAP      = 28;

    // Default (no trust row to dodge, or trust not on this same row).
    let maxW  = trustBounds ? 440 : 620;
    let signY = S.y;

    // Sharing a row with the trust bullets: derive width and y from the trust
    // block's real rendered bounds so the two never overlap, whatever the copy.
    if (trustBounds && S.shareTrustRow) {
      if (S.align === "right")      maxW = Math.max(150, S.x - trustBounds.right - GAP);
      else if (S.align === "left")  maxW = Math.max(150, trustBounds.left - S.x - GAP);
      signY = trustBounds.centerY + 9;   // alphabetic baseline vs. visual centre
    }

    ctx.textBaseline = "alphabetic";
    ctx.font = dFont(30);
    const bw = ctx.measureText(brandStr).width;
    ctx.font = dFont(26, P.italicAccent, "normal");
    const tw  = tag ? ctx.measureText(tag).width : 0;
    const gap = tag ? 14 : 0;

    if (!tag || bw + gap + tw <= maxW) {
      const total = bw + gap + tw;
      const x0 = S.align === "right" ? S.x - total : S.align === "left" ? S.x : S.x - total / 2;
      ctx.textAlign = "left";
      ctx.fillStyle = textCol; ctx.font = dFont(30);
      ctx.fillText(brandStr, x0, signY);
      if (tag) {
        ctx.fillStyle = accent; ctx.font = dFont(26, P.italicAccent, "normal");
        ctx.fillText(tag, x0 + bw + gap, signY);
      }
    } else {
      ctx.textAlign = S.align as Align;
      ctx.fillStyle = textCol; ctx.font = dFont(30);
      ctx.fillText(brandStr, S.x, signY - 34);
      const tf = fitText(ctx, tag, {
        fontFor: (s) => dFont(s, P.italicAccent, "normal"), maxSize: 26, minSize: 18, maxW, maxLines: 1,
      });
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = accent; ctx.font = dFont(tf.size, P.italicAccent, "normal");
      ctx.fillText(tf.lines[0], S.x, signY);
    }

    const ruleX = S.align === "right" ? S.x - 60 : S.align === "left" ? S.x : S.x - 30;
    ctx.fillStyle = accent;
    ctx.fillRect(ruleX, signY + 14, 60, 2);
  }

  // ── 5. Composite + encode ─────────────────────────────────────────────────
  canvas = await sharp(canvas)
    .composite([{ input: nc.toBuffer("image/png"), blend: "over" }])
    .png()
    .toBuffer();

  const out = await sharp(canvas).jpeg({ quality: 93 }).toBuffer();
  i.log(`[promo] done — ${out.length} bytes`);
  return out;
}
