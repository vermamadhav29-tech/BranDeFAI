import prisma from "../utils/prisma";
import * as openaiService from "./ai/openaiService";
import * as imageGenService from "./ai/imageGenService";
import * as promptBuilder from "../utils/promptBuilder";
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

const REGEN_CAPTIONS_PROMPT = `Generate 3 fresh Instagram captions for this brand. Return ONLY a JSON object: { "captions": ["caption1", "caption2", "caption3"] }

Caption 1 (Emotional): Hook = personal, relatable, raw opening that creates immediate emotional connection. Body = 2-3 emotionally resonant lines. CTA = warm and inviting. End with exactly 5 lowercase hashtags (2 niche, 3 broad).
Caption 2 (Aspirational): Hook = paints who the reader becomes. Body = 2-3 lines that elevate and inspire. CTA = transformation-focused. End with exactly 5 lowercase hashtags.
Caption 3 (Direct/Offer): Hook = the product benefit or offer, no fluff. Body = 1-2 concrete reasons to act now. CTA = direct and action-driving (link in bio / DM us / Shop now). End with exactly 5 lowercase hashtags.
Format each: [Hook line]\\n\\n[Body]\\n\\n[CTA]\\n\\n#tag1 #tag2 #tag3 #tag4 #tag5
Max 150 words per caption. Reference the brand name naturally. Never generic, never hollow.`;

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

export async function regenerateCaptions(
  contentId: string,
  userId: string
): Promise<string[]> {
  const content = await prisma.generatedContent.findFirst({
    where: { id: contentId, userId },
    include: { brand: true },
  });
  if (!content) throw createError("Content not found", 404);

  const systemPrompt = promptBuilder.buildContentSystemPrompt(
    content.brand,
    content.brand.strategyData
  );

  const result = (await openaiService.generateText(systemPrompt, REGEN_CAPTIONS_PROMPT, true)) as {
    captions: string[];
  };

  await prisma.generatedContent.update({
    where: { id: contentId },
    data: { captions: JSON.parse(JSON.stringify(result.captions)) },
  });

  await deductCredits(prisma, userId, 2, CreditType.GENERATION, contentId);

  return result.captions;
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
