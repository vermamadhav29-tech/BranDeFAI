import type { Brand } from "@prisma/client";
import type { VisionAnalysis } from "../services/ai/openaiService";

interface LocalStrategyData {
  contentPillars?: Array<{ name: string; description: string; examples: string[] }>;
  monthDirectionSummary?: string;
}

// ─── buildBrandSystemPrompt ───────────────────────────────────────────────────
// Used by strategyService. Keep minimal — strategy generation has its own context.

export function buildBrandSystemPrompt(brand: Brand, strategyData?: unknown): string {
  const lines = [
    `You are a professional brand content creator for ${brand.brandName}, a ${brand.industry} brand.`,
    `Brand tone: ${brand.tone}.`,
    `Target audience: ${brand.targetAudience}.`,
  ];

  if (strategyData) {
    const sd = strategyData as LocalStrategyData;
    const pillarNames = sd.contentPillars?.map((p) => p.name) ?? [];
    if (pillarNames.length) {
      lines.push(`Content pillars: ${pillarNames.join(", ")}.`);
    }
    if (sd.monthDirectionSummary) {
      lines.push(`Core content direction: ${sd.monthDirectionSummary}`);
    }
  }

  return lines.join("\n");
}

// ─── buildContentSystemPrompt ─────────────────────────────────────────────────
// Premium system prompt used by contentService for all caption, ad copy, and reel generation.

export function buildContentSystemPrompt(
  brand: Brand,
  strategyData?: unknown,
  product?: VisionAnalysis | null
): string {
  const lines = [
    `You are an expert Instagram copywriter and performance marketer for premium Indian ${brand.industry} brands.`,
    `Write copy that feels human, aspirational, and scroll-stopping — never generic, never hollow.`,
  ];

  if (brand.voiceSummary) {
    lines.push(``, `BRAND VOICE`, brand.voiceSummary);
  }

  lines.push(
    ``,
    `BRAND PROFILE`,
    `Brand: ${brand.brandName}`,
    `Industry: ${brand.industry}`,
    `Tone of voice: ${brand.tone}`,
    `Target audience: ${brand.targetAudience}`
  );

  if (brand.brandBrief) {
    lines.push(`Brand brief: ${brand.brandBrief}`);
  }

  if (brand.platforms?.length) {
    lines.push(`Sells on: ${brand.platforms.join(", ")}`);
  }

  if (product) {
    lines.push(
      ``,
      `FEATURED PRODUCT`,
      `Name: ${product.productName}`,
      `Description: ${product.physicalDescription}`,
      `Colours: ${product.colorPalette.join(", ")}`,
      `Use case: ${product.useCase}`,
      `Marketing angle: ${product.marketingAngle}`,
      `Emotional appeal: ${product.emotionalAppeal}`
    );
  }

  if (strategyData) {
    const sd = strategyData as LocalStrategyData;
    const pillarNames = sd.contentPillars?.map((p) => p.name) ?? [];
    if (pillarNames.length) {
      lines.push(``, `CONTENT STRATEGY`, `Pillars: ${pillarNames.join(" | ")}`);
    }
    if (sd.monthDirectionSummary) {
      lines.push(`Month direction: ${sd.monthDirectionSummary}`);
    }
  }

  lines.push(
    ``,
    `RULES`,
    `- Always reference ${brand.brandName} naturally at least once in every caption and every ad copy variation.`,
    `- Every caption's first line must stop the scroll — it is the hook, make it count.`,
    `- Match the ${brand.tone} tone precisely and consistently across all outputs.`,
    `- Write for the Indian market — Hinglish is welcome where it feels authentic to the brand voice.`
  );

  return lines.join("\n");
}

// ─── buildProductContext ──────────────────────────────────────────────────────

export function buildProductContext(visionAnalysis: VisionAnalysis): string {
  return [
    `Featured product: ${visionAnalysis.productName}.`,
    `Description: ${visionAnalysis.physicalDescription}.`,
    `Colors: ${visionAnalysis.colorPalette.join(", ")}.`,
    `Use case: ${visionAnalysis.useCase}.`,
    `Marketing angle: ${visionAnalysis.marketingAngle}`,
  ].join(" ");
}
