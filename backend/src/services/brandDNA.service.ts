import prisma from "../utils/prisma";
import { generateText } from "./ai/openaiService";
import { createError } from "../middleware/errorHandler";

const BRAND_DNA_SYSTEM_PROMPT = `You are a senior brand strategist for Indian businesses. Based on minimal brand details,
create a deep Brand DNA profile. The user is an Indian small business owner.
Infer everything — do not ask for more info. Return ONLY valid JSON, no other text:
{ brand_personality: [3 personality traits as strings],
voice_description: string (how this brand speaks in one sentence),
speaks_like: [2 example phrases this brand would use],
never_says: [2 phrases this brand would never use],
visual_mood: string (color and photography aesthetic),
target_customer: { name: string, age: string, lifestyle: string, desires: string },
emotional_hooks: [3 emotions this brand sells],
content_pillars: [4 Instagram content themes],
tone_rules: { dos: [3 rules], donts: [3 rules] },
hinglish_style: string (how to naturally mix Hindi and English for this brand),
sample_caption: string (one perfect Instagram caption in this brand voice)
}`;

export interface BrandDNAInput {
  brandName: string;
  whatTheySell?: string | null;
  brandBrief?: string | null;
  industry?: string | null;
  brandVibe: string;
}

export interface BrandDNA {
  brand_personality: string[];
  voice_description: string;
  speaks_like: string[];
  never_says: string[];
  visual_mood: string;
  target_customer: { name: string; age: string; lifestyle: string; desires: string };
  emotional_hooks: string[];
  content_pillars: string[];
  tone_rules: { dos: string[]; donts: string[] };
  hinglish_style: string;
  sample_caption: string;
}

export async function generateBrandDNA(brandData: BrandDNAInput): Promise<BrandDNA> {
  const { brandName, brandVibe } = brandData;
  const whatTheySell = brandData.whatTheySell || brandData.brandBrief || brandData.industry || "";

  const userPrompt = [
    `Business name: ${brandName}`,
    `What they sell: ${whatTheySell}`,
    `Brand vibe: ${brandVibe}`,
    `Generate a complete Brand DNA profile for this Indian business.`,
  ].join("\n");

  return (await generateText(BRAND_DNA_SYSTEM_PROMPT, userPrompt, true, 2000)) as BrandDNA;
}

export async function getBrandContext(brandId: string, campaignBrief?: string): Promise<string> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw createError("Brand not found", 404);
  if (!brand.brandDna) throw createError("Brand DNA has not been generated yet", 404);

  const dna = JSON.parse(brand.brandDna) as BrandDNA;

  return [
    `BRAND DNA:`,
    `Business: ${brand.brandName} | Sells: ${brand.whatTheySell || brand.brandBrief || brand.industry}`,
    `Personality: ${dna.brand_personality.join(", ")}`,
    `Voice: ${dna.voice_description}`,
    `Speaks like: ${dna.speaks_like.join(" | ")}`,
    `Never says: ${dna.never_says.join(" | ")}  Visual mood: ${dna.visual_mood}`,
    `Target customer: ${dna.target_customer.name}, ${dna.target_customer.age} — ${dna.target_customer.lifestyle}`,
    `Emotional hooks: ${dna.emotional_hooks.join(", ")}`,
    `Content pillars: ${dna.content_pillars.join(", ")}`,
    `Tone DOs: ${dna.tone_rules.dos.join(" | ")}`,
    `Tone DON'Ts: ${dna.tone_rules.donts.join(" | ")}`,
    `Hinglish style: ${dna.hinglish_style}`,
    `Sample caption: ${dna.sample_caption}`,
    ``,
    `TODAY'S BRIEF: ${campaignBrief || "General brand content"}`,
  ].join("\n");
}
