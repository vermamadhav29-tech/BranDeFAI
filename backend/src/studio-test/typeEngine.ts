/**
 * typeEngine.ts — measureText-based fitting so copy never overflows its region.
 */

import type { createCanvas } from "canvas";

export type Ctx2D = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;
export type Align = "left" | "right" | "center";

export interface FitOptions {
  fontFor:     (size: number) => string;  // e.g. (s) => `bold ${s}px 'Playfair Display'`
  maxSize:     number;
  minSize:     number;
  maxW:        number;
  maxH?:       number;
  maxLines?:   number;
  lineHeight?: number;   // multiplier, default 1.15
  step?:       number;   // px decrement per iteration, default 2
}

export interface FitResult {
  size:   number;
  lines:  string[];
  lineH:  number;
  totalH: number;
}

function wrapByWidth(ctx: Ctx2D, text: string, maxW: number): string[] | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (ctx.measureText(w).width > maxW) return null;   // single word too wide → shrink
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrinks font size until the text fits width, height and line-count limits. */
export function fitText(ctx: Ctx2D, text: string, o: FitOptions): FitResult {
  const lh   = o.lineHeight ?? 1.15;
  const step = o.step ?? 2;
  let last: FitResult | null = null;

  for (let size = o.maxSize; size >= o.minSize; size -= step) {
    ctx.font = o.fontFor(size);
    const lines = wrapByWidth(ctx, text, o.maxW);
    if (!lines) continue;
    const lineH  = Math.round(size * lh);
    const totalH = lineH * lines.length;
    last = { size, lines, lineH, totalH };
    const linesOk = o.maxLines === undefined || lines.length <= o.maxLines;
    const hOk     = o.maxH === undefined || totalH <= o.maxH;
    if (linesOk && hOk) return last;
  }

  // Could not satisfy constraints — return the smallest attempt, truncated to maxLines.
  ctx.font = o.fontFor(o.minSize);
  const lines = wrapByWidth(ctx, text, o.maxW) ?? [text];
  const cut   = o.maxLines ? lines.slice(0, o.maxLines) : lines;
  const lineH = Math.round(o.minSize * lh);
  return last && last.lines.length <= (o.maxLines ?? Infinity)
    ? last
    : { size: o.minSize, lines: cut, lineH, totalH: lineH * cut.length };
}

/** Draws pre-fitted lines with textBaseline="top". Returns the y after the last line. */
export function drawLines(
  ctx: Ctx2D,
  lines: string[],
  x: number,
  yTop: number,
  lineH: number,
  align: Align,
): number {
  ctx.textAlign    = align;
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, x, yTop + i * lineH));
  return yTop + lines.length * lineH;
}

/** Letter-spaced text (node-canvas has no letterSpacing). Returns the drawn width. */
export function drawTracked(
  ctx: Ctx2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: Align,
): number {
  const chars  = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total  = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  let cx = align === "left" ? x : align === "right" ? x - total : x - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + tracking; });
  ctx.textAlign = prevAlign;
  return total;
}

export function measureTracked(ctx: Ctx2D, text: string, tracking: number): number {
  const chars = [...text];
  return chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + tracking * Math.max(0, chars.length - 1);
}
