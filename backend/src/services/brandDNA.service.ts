// URL analysis uses GPT-4o web browsing — no third-party scraper needed.
import prisma from "../utils/prisma";
import { generateText, openai } from "./ai/openaiService";
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
  url?: string;
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

// ─── URL brand analysis via GPT-4o web browsing ───────────────────────────────
// Tries Responses API with web_search_preview first; falls back to URL-only
// inference if the tool is unavailable. Always returns "" on any failure —
// never blocks onboarding.

const URL_ANALYST_PROMPT =
  `You are a brand analyst. Visit the URL provided and analyse the brand. ` +
  `Extract: what they sell, their tone of voice, the kind of language they use, ` +
  `their visual aesthetic described in words, who their target customer appears to be, ` +
  `and any recurring themes or messaging you notice. ` +
  `Return ONLY a plain text summary of 150-200 words. No JSON. No bullet points. ` +
  `Write it as a paragraph a copywriter could read to understand this brand.`;

const URL_FALLBACK_PROMPT =
  `Based on this URL alone (you cannot browse it), infer what you can about ` +
  `this brand from the URL structure, domain name, and any patterns you recognise. ` +
  `Return a 2-3 sentence inference. Make clear this is inferred, not confirmed.`;

export async function analyseUrlForBrandContext(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Primary path: Responses API with web_search_preview
  try {
    const response = await openai.responses.create(
      {
        model: "gpt-4o",
        tools: [{ type: "web_search_preview" }],
        instructions: URL_ANALYST_PROMPT,
        input: `Analyse this brand: ${trimmed}`,
        max_output_tokens: 400,
      },
      { signal: AbortSignal.timeout(30_000) }
    );

    type OutputItem = { type: string; content?: { type: string; text?: string }[] };
    const text = (response.output as OutputItem[])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => (c.text ?? "").trim())
      .filter(Boolean)
      .join(" ");

    if (text) return `BRAND ANALYSIS FROM THEIR PAGE:\n${text}`;
  } catch {
    // Responses API unavailable or timed out — fall through to URL-only fallback
  }

  // Fallback: URL-only inference via chat completions (zero extra cost)
  try {
    const fallback = (await generateText(
      URL_FALLBACK_PROMPT,
      `Brand URL: ${trimmed}`,
      false,
      200
    )) as string;
    const cleaned = fallback?.trim() ?? "";
    if (cleaned) return `BRAND ANALYSIS FROM THEIR PAGE:\n${cleaned}`;
  } catch {
    // Ignore — never block onboarding
  }

  return "";
}

// ─── generateBrandDNA ─────────────────────────────────────────────────────────

export async function generateBrandDNA(brandData: BrandDNAInput): Promise<BrandDNA> {
  const { brandName, brandVibe, url } = brandData;
  const whatTheySell = brandData.whatTheySell || brandData.brandBrief || brandData.industry || "";

  const parts: string[] = [
    `Business name: ${brandName}`,
    `What they sell: ${whatTheySell}`,
    `Brand vibe: ${brandVibe}`,
  ];

  if (url) {
    const urlContext = await analyseUrlForBrandContext(url);
    if (urlContext) parts.push(urlContext);
  }

  parts.push("Using ALL of the above, generate a complete Brand DNA profile for this Indian business.");

  const userPrompt = parts.join("\n");

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
