import prisma from "../utils/prisma";
import * as openaiService from "./ai/openaiService";
import * as imageGenService from "./ai/imageGenService";
import * as promptBuilder from "../utils/promptBuilder";
import { getBrandContext } from "./brandDNA.service";
import * as qualityGate from "./qualityGate.service";
import { deductCredits } from "../utils/creditUtils";
import { ImageSource, CreditType } from "@prisma/client";
import { createError } from "../middleware/errorHandler";
import type { VisionAnalysis } from "./ai/openaiService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdCopyVariation {
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
}

interface ReelIdea {
  hook: string;
  shotList: string[];
  audioType: string;
  duration: string;
  caption: string;
}

interface GeneratedTextContent {
  captions: string[];
  adCopy: { headline: string; body: string; cta: string };
  adCopyVariations: AdCopyVariation[];
  reelIdeas: ReelIdea[];
  keywords: string[];
}

export interface ContentBatchResult {
  contentId: string;
  captions: unknown;
  adCopy: unknown;
  reelIdeas: unknown;
  images: (string | null)[];
  keywords: string[];
}

export type GenerationGoal = "promotional" | "awareness" | "engagement";

export interface CaptionVariant {
  type: "emotional" | "offer_driven" | "festival_occasion";
  hook: string;
  body: string;
  cta: string;
  full_caption: string;
  hashtags: string[];
}

interface CaptionGenerationResult {
  captions: CaptionVariant[];
  seo_keywords: string[];
}

export interface CaptionResponse {
  caption: CaptionVariant;
  hasMoreAlternates: boolean;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const BATCH_TEXT_PROMPT = `Generate premium brand content as a single valid JSON object with EXACTLY this structure — no extra keys, no markdown, no code fences:

{
  "captions": [
    "emotional_caption_full_text",
    "aspirational_caption_full_text",
    "direct_caption_full_text"
  ],
  "adCopy": { "headline": "...", "body": "...", "cta": "..." },
  "adCopyVariations": [
    { "primaryText": "...", "headline": "...", "description": "...", "cta": "..." },
    { "primaryText": "...", "headline": "...", "description": "...", "cta": "..." }
  ],
  "reelIdeas": [
    { "hook": "...", "shotList": ["1. ...", "2. ...", "3. ...", "4. ...", "5. ..."], "audioType": "...", "duration": "...", "caption": "..." },
    { "hook": "...", "shotList": ["1. ...", "2. ...", "3. ...", "4. ...", "5. ..."], "audioType": "...", "duration": "...", "caption": "..." }
  ],
  "keywords": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"]
}

CAPTION RULES — exactly 3, each max 150 words, brand name used naturally in each:
Caption 1 (Emotional): Hook = personal or raw opening line that creates an immediate emotional connection. Body = 2-3 lines of emotional resonance. CTA = warm, inviting. End with exactly 5 lowercase hashtags (2 niche, 3 broad).
Caption 2 (Aspirational): Hook = paints who the reader becomes by owning this. Body = 2-3 lines that elevate and inspire. CTA = transformation-focused. End with exactly 5 lowercase hashtags.
Caption 3 (Direct/Offer): Hook = the product benefit or offer, no fluff. Body = 1-2 concrete reasons to act right now. CTA = direct and action-driving (link in bio / DM us / Shop now). End with exactly 5 lowercase hashtags.
Format each caption exactly as: [Hook line]\\n\\n[Body 2-3 lines]\\n\\n[CTA line]\\n\\n#tag1 #tag2 #tag3 #tag4 #tag5

AD COPY RULES — exactly 2 variations:
Variation 1 (Benefit-led): primaryText under 125 chars, leads with the key product benefit. headline under 40 chars, benefit statement. description under 30 chars, social proof or standout feature. cta = "Shop Now" or "Learn More".
Variation 2 (Urgency/Offer): primaryText under 125 chars, urgency or scarcity signal. headline under 40 chars, offer or time pressure. description under 30 chars, urgency line. cta = "Shop Now" or "Message Us".
Populate adCopy from Variation 1: headline → adCopy.headline, primaryText → adCopy.body, cta → adCopy.cta.

REEL IDEA RULES — exactly 2 ideas, each with:
- hook: text overlay for the first 3 seconds, short and scroll-stopping
- shotList: 5-7 numbered scene descriptions with visual direction (e.g. "1. Close-up of hands unboxing, slow-motion, warm light")
- audioType: one of "trending upbeat" | "emotional acoustic" | "lo-fi beats" | "voiceover + music" | "silence + bold text"
- duration: one of "15s" | "30s" | "60s"
- caption: complete Instagram caption for the reel post, max 100 words, ending with exactly 5 lowercase hashtags

KEYWORD RULES — exactly 10 searchable discovery terms for Instagram SEO. Mix English and Hinglish for Indian market discoverability. Specific to the brand's industry, products, and target audience.`;

const CAPTION_SYSTEM_PROMPT = `You are the lead copywriter for a premium Indian brand. You write Instagram captions
that sell without sounding salesy. You understand Indian consumer psychology deeply.
Rules you always follow:
- Open with a scroll-stopping hook (first line must make them stop scrolling)
- Build desire in 2-3 lines using emotional language, not features
- End with a clear CTA that matches Indian behavior (DM on WhatsApp, visit store, order now)
- Match the brand voice EXACTLY from the Brand DNA provided
- If the brand uses Hinglish, weave it in naturally — never forced
- Never use hollow phrases: 'elevate your style', 'discover elegance', 'a cut above'
- Be specific about the product, not vague
- Write like a real person who loves this brand, not an AI
Return ONLY valid JSON, no other text:
{
captions: [
{ type: 'emotional', hook: string, body: string, cta: string, full_caption: string, hashtags: [5 lowercase strings] },
{ type: 'offer_driven', hook: string, body: string, cta: string, full_caption: string, hashtags: [5 lowercase strings] },
{ type: 'festival_occasion', hook: string, body: string, cta: string, full_caption: string, hashtags: [5 lowercase strings] }
],
seo_keywords: [10 relevant Instagram search keywords for this post]
}`;

const INDIAN_CONTEXT_BLOCK = `Writing for Indian audience. Peak posting: 8-10am, 12-2pm, 8-11pm IST.
Include city hashtag like #DelhiFood or #MumbaiJewellery.
WhatsApp CTAs convert 3x better than link-in-bio for Indian SMBs.`;

function buildCaptionUserPrompt(brandDnaBlock: string, campaignBrief: string, goal: GenerationGoal): string {
  return [brandDnaBlock, INDIAN_CONTEXT_BLOCK, campaignBrief, goal].join("\n");
}

// Heuristic hook-strength scorer used to pick "the highest-quality" caption —
// rewards scroll-stopping length, pattern interrupts, and specificity; penalizes
// the hollow phrases the system prompt explicitly bans.
const HOLLOW_PHRASES = ["elevate your style", "discover elegance", "a cut above"];

function scoreHookStrength(hook: string): number {
  let score = 0;
  const lower = hook.toLowerCase();

  const len = hook.length;
  if (len >= 25 && len <= 90) score += 3;
  else if (len > 0) score += 1;

  if (/[!?]/.test(hook)) score += 2;
  if (/\d/.test(hook)) score += 1;
  if (HOLLOW_PHRASES.some((p) => lower.includes(p))) score -= 5;

  return score;
}

export function pickBestCaption(captions: CaptionVariant[]): { selected: CaptionVariant; alternates: CaptionVariant[] } {
  let bestIndex = 0;
  let bestScore = -Infinity;
  captions.forEach((c, i) => {
    const score = scoreHookStrength(c.hook);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });
  const selected = captions[bestIndex];
  const alternates = captions.filter((_, i) => i !== bestIndex);
  return { selected, alternates };
}

// Maps common industry keywords to a hashtag-friendly category word, e.g.
// "Bakery & desserts" -> "Food", "Fine jewellery" -> "Jewellery".
const CITY_HASHTAG_CATEGORIES: { keywords: string[]; tag: string }[] = [
  { keywords: ["food", "restaurant", "cafe", "bakery", "gelato", "ice cream", "dessert", "sweet", "catering", "kitchen"], tag: "Food" },
  { keywords: ["jewel"], tag: "Jewellery" },
  { keywords: ["fashion", "apparel", "clothing", "boutique", "wear"], tag: "Fashion" },
  { keywords: ["beauty", "cosmetic", "skincare", "salon", "spa"], tag: "Beauty" },
  { keywords: ["fitness", "gym", "yoga", "wellness"], tag: "Fitness" },
  { keywords: ["home", "decor", "furniture", "interior"], tag: "Decor" },
  { keywords: ["tech", "software", "saas", "app"], tag: "Tech" },
  { keywords: ["real estate", "realty", "property"], tag: "Realty" },
];

function getIndustryHashtagWord(industry?: string | null): string {
  if (!industry) return "";
  const lower = industry.toLowerCase();
  const match = CITY_HASHTAG_CATEGORIES.find((c) => c.keywords.some((k) => lower.includes(k)));
  if (match) return match.tag;

  const firstWord = industry.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "");
  if (!firstWord) return "";
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

function getCityHashtag(brand: { city?: string | null; industry?: string | null } | null): string | null {
  if (!brand?.city) return null;
  const cityPart = brand.city.trim().replace(/[^a-zA-Z]/g, "");
  if (!cityPart) return null;
  return `#${cityPart}${getIndustryHashtagWord(brand.industry)}`;
}

function buildShownHashtags(
  caption: CaptionVariant,
  brand: { id: string; city?: string | null; industry?: string | null }
): string[] {
  const cityTag = getCityHashtag(brand);
  if (!cityTag) return caption.hashtags.slice(0, 5);
  return [cityTag, ...caption.hashtags.filter((t) => t !== cityTag)].slice(0, 5);
}

export async function generateCaptionSet(
  brandDnaBlock: string,
  campaignBrief: string,
  goal: GenerationGoal
): Promise<CaptionGenerationResult> {
  const userPrompt = buildCaptionUserPrompt(brandDnaBlock, campaignBrief, goal);
  return (await openaiService.generateText(
    CAPTION_SYSTEM_PROMPT,
    userPrompt,
    true,
    2000,
    0.9
  )) as CaptionGenerationResult;
}

const REGEN_ADCOPY_PROMPT = `Generate fresh Meta ad copy for this brand. Return ONLY a JSON object with exactly this shape:
{
  "adCopy": { "headline": "...", "body": "...", "cta": "..." },
  "adCopyVariations": [
    { "primaryText": "...", "headline": "...", "description": "...", "cta": "..." },
    { "primaryText": "...", "headline": "...", "description": "...", "cta": "..." }
  ]
}

Variation 1 (Benefit-led): primaryText under 125 chars, leads with the key product benefit. headline under 40 chars, benefit statement. description under 30 chars, social proof or standout feature. cta = "Shop Now" or "Learn More".
Variation 2 (Urgency/Offer): primaryText under 125 chars, urgency or scarcity signal. headline under 40 chars, offer or time pressure. description under 30 chars, urgency line. cta = "Shop Now" or "Message Us".
Populate adCopy from Variation 1: headline → adCopy.headline, primaryText → adCopy.body, cta → adCopy.cta.
Reference the brand name naturally. Write for Indian audiences.`;

// ─── generateContentBatch ─────────────────────────────────────────────────────

export async function generateContentBatch(
  userId: string,
  brandId: string,
  productImageId?: string
): Promise<ContentBatchResult> {
  // Step 1: Fetch brand and verify strategy is approved
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand || brand.userId !== userId) throw createError("Brand not found", 404);
  if (!brand.strategyApproved) {
    throw createError("Approve your strategy before generating content", 403);
  }

  // Step 2: Load product image vision analysis if provided
  let visionAnalysis: VisionAnalysis | null = null;

  if (productImageId) {
    const productImage = await prisma.productImage.findUnique({ where: { id: productImageId } });
    if (!productImage || productImage.userId !== userId) {
      throw createError("Product image not found", 404);
    }
    if (productImage.visionAnalysis) {
      visionAnalysis = productImage.visionAnalysis as unknown as VisionAnalysis;
    }
  }

  // Step 3: Build premium system prompt with full brand + product context
  const systemPrompt = promptBuilder.buildContentSystemPrompt(brand, brand.strategyData, visionAnalysis);

  // Step 4: Image prompts
  const productName = visionAnalysis?.productName ?? brand.brandName;

  const imgPrompt1 = visionAnalysis
    ? `Product marketing photo of: ${visionAnalysis.productName}. ${visionAnalysis.physicalDescription}. Clean white background, professional studio lighting, sharp focus, 8K quality, commercial photography style.`
    : `Professional brand marketing image, ${brand.tone} style, targeting ${brand.targetAudience}, ${brand.industry} brand visual.`;

  const imgPrompt2 = `Lifestyle marketing scene featuring ${productName}. ${brand.tone} mood, aspirational, targeting ${brand.targetAudience}. Natural lighting, authentic feel, Instagram-worthy composition.`;

  // Step 5: Run text + image generation in parallel
  const [textResult, img1Result, img2Result] = await Promise.allSettled([
    openaiService.generateText(systemPrompt, BATCH_TEXT_PROMPT, true),
    imageGenService.generateImage(imgPrompt1, "photorealistic", "1:1"),
    imageGenService.generateImage(imgPrompt2, brand.tone, "4:5"),
  ]);

  // Step 6: Extract results — text is required, images are optional
  const textContent =
    textResult.status === "fulfilled" ? (textResult.value as GeneratedTextContent) : null;
  const img1Url = img1Result.status === "fulfilled" ? img1Result.value : null;
  const img2Url = img2Result.status === "fulfilled" ? img2Result.value : null;

  if (img1Result.status === "rejected") {
    console.error("[contentService] Image 1 generation failed:", img1Result.reason);
  }
  if (img2Result.status === "rejected") {
    console.error("[contentService] Image 2 generation failed:", img2Result.reason);
  }

  if (!textContent) {
    const reason = textResult.status === "rejected" ? textResult.reason : null;
    console.error("[contentService] Text generation failed:", reason);
    throw createError((reason as Error)?.message ?? "Text generation failed", 502);
  }

  // Step 7: Embed adCopyVariations and keywords inside the adCopy JSON blob so they
  // persist without requiring a schema change (adCopy column is already Json type).
  const enrichedAdCopy = {
    ...textContent.adCopy,
    variations: textContent.adCopyVariations ?? [],
    keywords: textContent.keywords ?? [],
  };

  const generatedContent = await prisma.generatedContent.create({
    data: {
      userId,
      brandId,
      productImageId: productImageId ?? null,
      captions: JSON.parse(JSON.stringify(textContent.captions)),
      adCopy: JSON.parse(JSON.stringify(enrichedAdCopy)),
      reelIdeas: JSON.parse(JSON.stringify(textContent.reelIdeas)),
      images: JSON.parse(JSON.stringify([img1Url ?? null, img2Url ?? null])),
    },
  });

  // Save any generated images as standalone GeneratedImage records
  const imagePromises: Promise<unknown>[] = [];

  if (img1Url) {
    imagePromises.push(
      prisma.generatedImage.create({
        data: {
          userId,
          brandId,
          originalPrompt: imgPrompt1,
          enhancedPrompt: imgPrompt1,
          imageUrl: img1Url,
          style: "photorealistic",
          format: "1:1",
          source: ImageSource.GENERATED,
        },
      })
    );
  }

  if (img2Url) {
    imagePromises.push(
      prisma.generatedImage.create({
        data: {
          userId,
          brandId,
          originalPrompt: imgPrompt2,
          enhancedPrompt: imgPrompt2,
          imageUrl: img2Url,
          style: brand.tone,
          format: "4:5",
          source: ImageSource.GENERATED,
        },
      })
    );
  }

  await Promise.allSettled(imagePromises);

  // Step 8: Deduct credits only after successful save
  await deductCredits(prisma, userId, 20, CreditType.GENERATION, generatedContent.id);

  return {
    contentId: generatedContent.id,
    captions: generatedContent.captions,
    adCopy: generatedContent.adCopy,
    reelIdeas: generatedContent.reelIdeas,
    images: [img1Url, img2Url],
    keywords: textContent.keywords ?? [],
  };
}

// ─── regenerateCaptions ───────────────────────────────────────────────────────
// Generates 3 fresh captions (emotional / offer_driven / festival_occasion), runs
// each through the silent AI quality gate (in parallel), swaps in the improved
// version where the gate demands it, and picks the highest-scoring one. The
// other 2 + all 10 SEO keywords are stored as alternates so "show me another"
// can serve them without another AI call. Quality scores are logged internally
// and never returned to the caller.

export async function regenerateCaptions(
  contentId: string,
  userId: string,
  campaignBrief = "",
  goal: GenerationGoal = "promotional"
): Promise<CaptionResponse> {
  const content = await prisma.generatedContent.findFirst({
    where: { id: contentId, userId },
    include: { brand: true },
  });
  if (!content) throw createError("Content not found", 404);

  const brandDnaBlock = await getBrandContext(content.brandId, campaignBrief);
  const result = await generateCaptionSet(brandDnaBlock, campaignBrief, goal);

  // Silent quality gate — review all 3 candidates in parallel, not sequentially,
  // so this adds latency only once (not 3x) on top of generation.
  const reviews = await Promise.all(
    result.captions.map((c) => qualityGate.reviewContent(c.full_caption, brandDnaBlock))
  );

  const reviewedCaptions: CaptionVariant[] = result.captions.map((c, i) => {
    const review = reviews[i];
    return review.needs_improvement && review.improved_version
      ? { ...c, full_caption: review.improved_version }
      : c;
  });

  let bestIndex = 0;
  reviews.forEach((r, i) => {
    if (r.overall_score > reviews[bestIndex].overall_score) bestIndex = i;
  });

  const selected = reviewedCaptions[bestIndex];
  const alternates = reviewedCaptions.filter((_, i) => i !== bestIndex);
  const shownHashtags = buildShownHashtags(selected, content.brand);
  const selectedWithShownTags: CaptionVariant = { ...selected, hashtags: shownHashtags };

  await prisma.generatedContent.update({
    where: { id: contentId },
    data: {
      captions: JSON.parse(JSON.stringify([selectedWithShownTags.full_caption])),
      captionSelected: JSON.parse(JSON.stringify(selectedWithShownTags)),
      captionAlternates: JSON.parse(JSON.stringify(alternates)),
      seoKeywords: JSON.parse(JSON.stringify(result.seo_keywords)),
      captionAltIndex: 0,
    },
  });

  // Internal-only analysis log — never surfaced via any API response.
  await prisma.contentQualityLog.createMany({
    data: reviews.map((r, i) => ({
      contentId,
      brandId: content.brandId,
      userId,
      scores: JSON.parse(
        JSON.stringify({ overall_score: r.overall_score, ...r.scores, captionType: result.captions[i].type })
      ),
      needsImprovement: r.needs_improvement,
    })),
  });

  await deductCredits(prisma, userId, 2, CreditType.GENERATION, contentId);

  return { caption: selectedWithShownTags, hasMoreAlternates: alternates.length > 0 };
}

// ─── getNextCaptionAlternate ──────────────────────────────────────────────────
// Serves the next stored alternate version — no AI call, no credit charge.

export async function getNextCaptionAlternate(
  contentId: string,
  userId: string
): Promise<CaptionResponse> {
  const content = await prisma.generatedContent.findFirst({
    where: { id: contentId, userId },
    include: { brand: true },
  });
  if (!content) throw createError("Content not found", 404);

  const alternates = (content.captionAlternates as unknown as CaptionVariant[] | null) ?? [];
  const cursor = content.captionAltIndex;

  if (cursor >= alternates.length) {
    throw createError("No more alternate versions. Regenerate for fresh captions.", 404);
  }

  const next = alternates[cursor];
  const shownHashtags = buildShownHashtags(next, content.brand);
  const nextWithShownTags: CaptionVariant = { ...next, hashtags: shownHashtags };
  const nextCursor = cursor + 1;

  await prisma.generatedContent.update({
    where: { id: contentId },
    data: {
      captions: JSON.parse(JSON.stringify([nextWithShownTags.full_caption])),
      captionSelected: JSON.parse(JSON.stringify(nextWithShownTags)),
      captionAltIndex: nextCursor,
    },
  });

  return { caption: nextWithShownTags, hasMoreAlternates: nextCursor < alternates.length };
}

// ─── regenerateAdCopy ─────────────────────────────────────────────────────────

export async function regenerateAdCopy(
  contentId: string,
  userId: string
): Promise<{ headline: string; body: string; cta: string }> {
  const content = await prisma.generatedContent.findFirst({
    where: { id: contentId, userId },
    include: { brand: true },
  });
  if (!content) throw createError("Content not found", 404);

  const systemPrompt = promptBuilder.buildContentSystemPrompt(
    content.brand,
    content.brand.strategyData
  );

  const result = (await openaiService.generateText(systemPrompt, REGEN_ADCOPY_PROMPT, true)) as {
    adCopy: { headline: string; body: string; cta: string };
    adCopyVariations: AdCopyVariation[];
  };

  // Persist the enriched adCopy (with variations) in the existing Json column
  const enrichedAdCopy = {
    ...result.adCopy,
    variations: result.adCopyVariations ?? [],
  };

  await prisma.generatedContent.update({
    where: { id: contentId },
    data: { adCopy: JSON.parse(JSON.stringify(enrichedAdCopy)) },
  });

  await deductCredits(prisma, userId, 2, CreditType.GENERATION, contentId);

  return result.adCopy;
}
