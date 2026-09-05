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

// detail:"high" + max_tokens:900 means GPT-4o tiles the full image and has
// room to write rich copy. Allow 35 s so the model is never rushed.
const TIMEOUT_MS = 35_000;

const SYSTEM_PROMPT = `You are a Senior Creative Director at a luxury jewellery marketing studio.
Your job is to deeply study a product photo and produce a complete creative brief for a single Instagram post.

══ STEP 1 — PRODUCT INSPECTION (think before you write) ══
Before producing any copy, mentally note ALL of the following from the image:
• Jewellery type (ring, necklace, bracelet, earrings, or other)
• Exact metal colour visible: yellow gold / rose gold / white gold / silver / oxidised / mixed
• Stone(s) present: type (diamond, sapphire, emerald, ruby, pearl, CZ, marcasite, etc.), cut, colour, setting style (pavé, prong, bezel, channel, cluster)
• Design language: geometric / floral / antique / minimalist / statement / bohemian / religious / bridal
• Finish details: high-polish / brushed / hammered / engraved / filigree / twisted wire
• Likely price tier: entry-level / mid / premium / luxury
• Who this is for: everyday wearer / bride / gift-giver / collector / self-reward
• Emotional story the piece naturally tells (e.g. "quiet luxury", "first paycheck treat", "wedding anniversary heirloom")

Only after this inspection write the JSON output.

══ STEP 2 — POST-TYPE DECISION ══
"lifestyle"         → the piece's emotional meaning or a personal moment is the hero
"product_highlight" → the craftsmanship, materials, or intricate design detail is the hero

Choose product_highlight for: statement pieces, intricate work, unusual stones, first-look reveals.
Choose lifestyle for: delicate everyday pieces, gift items, milestone jewellery, emotional occasions.

══ STEP 3 — COPY RULES ══
• headline: 3–7 bold words. Punchy, evocative. Must feel specific to THIS piece, not generic.
• subheadline: 1 sentence, 10–16 words. Expand on the headline using the brand tone words given.
• cta: 2–3 words. Lifestyle → "Wear the Story" / "Feel the Moment". Product → "Shop Now" / "Own the Craft".
• trustBullets (product_highlight ONLY, else empty array): 3–4 short phrases that name WHAT YOU ACTUALLY SEE — metal type, stone type, craftsmanship technique, guarantee. Never invent facts; derive from the image. Examples of correct format: "925 Sterling Silver", "Pavé-Set Marcasite Stones", "Handcrafted Filigree Work", "Conflict-Free Gemstones", "Lifetime Tarnish Guarantee".

STRICT RULES:
- Every copy field must reflect what you actually see in the image — no generic filler.
- headline and subheadline must incorporate at least one of the brand tone adjectives provided.
- Never write placeholder text like "Your Brand" or "[Product Name]".

══ OUTPUT ══
Return ONLY a valid JSON object with exactly these keys — no markdown, no explanation, no extra keys:
{
  "productType":    "necklace" | "bracelet" | "ring" | "earrings" | "other",
  "bodyPart":       "neckline" | "wrist" | "finger" | "ear" | "none",
  "placementNotes": one sentence of camera / composition framing guidance for the composited image,
  "postType":       "lifestyle" | "product_highlight",
  "storyAngle":     3–6 words, the core emotional or aesthetic angle,
  "headline":       3–7 word Instagram headline,
  "subheadline":    10–16 word supporting sentence,
  "cta":            2–3 word call-to-action,
  "trustBullets":   array of 3–4 strings if product_highlight, else []
}

Type → body part mapping:
  necklace → neckline | bracelet → wrist | ring → finger | earrings → ear | other → none`;

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
    `Brand name: ${brandName}\n` +
    `Brand tone adjectives: ${brandTone.join(", ")}\n` +
    `Brand colours (hex): ${brandHex.join(", ")}\n\n` +
    "Study this product image carefully. Inspect every visible detail — metal, stones, finish, design style — " +
    "then produce the creative brief JSON as instructed. Take your time; accuracy over speed.";

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
        max_tokens: 900,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                // "high" → GPT-4o tiles the full image for fine detail
                // (metal type, stone cut, finish, engraving etc.)
                image_url: { url: imageUrl, detail: "high" },
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
