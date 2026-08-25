/**
 * productVision.ts
 *
 * Self-contained GPT-4o Vision + Creative Director client for the studio-test
 * module. Imports NOTHING from the existing service pipeline.
 *
 * Single call returns: product classification, placement guidance, post-type
 * decision (lifestyle vs product_highlight), story angle, and real ad copy —
 * one round-trip to GPT-4o instead of separate vision + copy calls.
 */

type Logger = (msg: string) => void;

export type JewelleryProductType =
  | "necklace"
  | "bracelet"
  | "ring"
  | "earrings"
  | "other";

export type BodyPart = "neckline" | "wrist" | "finger" | "ear" | "none";

export type PostType = "lifestyle" | "product_highlight";

export interface CreativeAnalysis {
  productType:    JewelleryProductType;
  bodyPart:       BodyPart;
  placementNotes: string;
  postType:       PostType;
  storyAngle:     string;     // e.g. "everyday elegance, self-gifting moment"
  headline:       string;     // 3-7 word social ad headline
  subheadline:    string;     // one sentence, 8-15 words
  cta:            string;     // 2-3 word call-to-action
  trustBullets:   string[];   // 3-4 phrases, product_highlight only; else []
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 15_000; // slightly longer than old vision-only call

const SYSTEM_PROMPT = `You are a Creative Director for a luxury jewellery brand marketing team.

Given a product photo and brand information, you will:
1. Classify the jewellery piece and where it is naturally worn
2. Decide whether this calls for a LIFESTYLE story or a PRODUCT HIGHLIGHT
3. Write real, evocative ad copy matching the brand's tone — not placeholder text

Return ONLY a JSON object with these exact keys and no other text:
{
  "productType":    one of "necklace" | "bracelet" | "ring" | "earrings" | "other",
  "bodyPart":       one of "neckline" | "wrist" | "finger" | "ear" | "none",
  "placementNotes": one sentence of camera framing guidance,
  "postType":       one of "lifestyle" | "product_highlight",
  "storyAngle":     3-6 words capturing the emotional or narrative angle (e.g. "everyday elegance, self-gifting moment"),
  "headline":       strong 3-7 word headline for an Instagram/social ad,
  "subheadline":    one sentence, 8-15 words, expanding on the headline with the brand tone,
  "cta":            2-3 word call-to-action (e.g. "Shop Now", "Discover More", "Wear the Story"),
  "trustBullets":   array of 3-4 short trust phrases IF postType is "product_highlight", else empty array
}

Post-type decision guide:
- Choose "lifestyle" when the piece evokes a moment, a feeling, or a personal story (delicate everyday wear, gifts, milestone pieces, emotional connection).
- Choose "product_highlight" when the piece's craftsmanship, materials, or design detail is the hero (statement jewellery, intricate work, first-look product reveals).

Copy rules:
- headline and subheadline must reflect the brand tone adjectives provided — they must feel earned, not generic.
- trustBullets (product_highlight only) must be contextually relevant to the specific piece observed and the brand. Examples: "Handcrafted in India", "925 Sterling Silver", "Lifetime Polish Guarantee", "Conflict-Free Stones". Generate contextually; do not repeat generic filler.
- Never use placeholder text like "Your Brand Name Here" or angle brackets.
- cta should match the post type — lifestyle posts suit "Wear the Story" or "Feel the Moment"; product posts suit "Shop Now" or "Discover the Craft".

Type → body part mapping:
  necklace  → neckline
  bracelet  → wrist
  ring      → finger
  earrings  → ear
  other     → none`;

export const CREATIVE_FALLBACK: CreativeAnalysis = {
  productType:    "other",
  bodyPart:       "neckline",
  placementNotes: "default centre-frame placement",
  postType:       "product_highlight",
  storyAngle:     "everyday elegance",
  headline:       "Crafted to Last",
  subheadline:    "Premium jewellery for every precious moment",
  cta:            "Shop Now",
  trustBullets:   [],
};

// ─── Validation sets ──────────────────────────────────────────────────────────

const VALID_PRODUCT_TYPES = new Set<string>([
  "necklace", "bracelet", "ring", "earrings", "other",
]);
const VALID_BODY_PARTS = new Set<string>([
  "neckline", "wrist", "finger", "ear", "none",
]);
const VALID_POST_TYPES = new Set<string>([
  "lifestyle", "product_highlight",
]);

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeCreative(input: {
  imageUrl:  string;
  brandName: string;
  brandTone: string[];
  brandHex:  string[];
  log:       Logger;
}): Promise<CreativeAnalysis> {
  const { imageUrl, brandName, brandTone, brandHex, log } = input;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("[creative] OPENAI_API_KEY not set — using fallback");
    return CREATIVE_FALLBACK;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const userText =
    `Brand: ${brandName}\n` +
    `Tone: ${brandTone.join(", ")}\n` +
    `Brand colours: ${brandHex.join(", ")}\n\n` +
    "Classify this jewellery product, choose the post type, and write the ad copy as instructed.";

  try {
    log(`[creative] GPT-4o analysing product + generating copy: ${imageUrl.slice(0, 70)}…`);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "low" },
              },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      log(`[creative] GPT-4o HTTP ${res.status}: ${txt.slice(0, 200)} — using fallback`);
      return CREATIVE_FALLBACK;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      log("[creative] GPT-4o returned empty content — using fallback");
      return CREATIVE_FALLBACK;
    }

    const parsed = JSON.parse(content) as Partial<CreativeAnalysis>;

    const productType: JewelleryProductType = VALID_PRODUCT_TYPES.has(parsed.productType ?? "")
      ? (parsed.productType as JewelleryProductType)
      : "other";

    const bodyPart: BodyPart = VALID_BODY_PARTS.has(parsed.bodyPart ?? "")
      ? (parsed.bodyPart as BodyPart)
      : "neckline";

    const postType: PostType = VALID_POST_TYPES.has(parsed.postType ?? "")
      ? (parsed.postType as PostType)
      : "product_highlight";

    const str = (v: unknown, fallback: string) =>
      typeof v === "string" && v.length > 0 ? v : fallback;

    const result: CreativeAnalysis = {
      productType,
      bodyPart,
      placementNotes: str(parsed.placementNotes, CREATIVE_FALLBACK.placementNotes),
      postType,
      storyAngle:     str(parsed.storyAngle,     CREATIVE_FALLBACK.storyAngle),
      headline:       str(parsed.headline,        CREATIVE_FALLBACK.headline),
      subheadline:    str(parsed.subheadline,     CREATIVE_FALLBACK.subheadline),
      cta:            str(parsed.cta,             CREATIVE_FALLBACK.cta),
      trustBullets:
        Array.isArray(parsed.trustBullets) && postType === "product_highlight"
          ? (parsed.trustBullets as unknown[])
              .filter((b): b is string => typeof b === "string" && b.length > 0)
              .slice(0, 4)
          : [],
    };

    log(`[creative] result: ${JSON.stringify(result)}`);
    return result;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const msg = err instanceof Error ? err.message : String(err);
    log(`[creative] GPT-4o ${isTimeout ? "timed out" : `failed: ${msg}`} — using fallback`);
    return CREATIVE_FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}
