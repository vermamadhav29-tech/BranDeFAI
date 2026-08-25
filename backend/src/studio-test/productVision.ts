/**
 * productVision.ts
 *
 * Self-contained GPT-4o vision client for the studio-test module.
 * Imports NOTHING from the existing service pipeline.
 *
 * Classifies the jewellery type from the product photo and returns the
 * body part where it is naturally worn so downstream steps can:
 *   1. Fill the {BODY_PART} slot in worn_lifestyle prompt skeletons.
 *   2. Choose the correct compositing placement zone.
 */

type Logger = (msg: string) => void;

export type JewelleryProductType =
  | "necklace"
  | "bracelet"
  | "ring"
  | "earrings"
  | "other";

export type BodyPart = "neckline" | "wrist" | "finger" | "ear" | "none";

export interface ProductAnalysis {
  productType: JewelleryProductType;
  bodyPart: BodyPart;
  placementNotes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT = `You are a jewellery product photography classifier.
Given a product photo, identify the jewellery type and where it is naturally worn on the body.

Return ONLY a JSON object with these exact keys and no other text:
{
  "productType": one of "necklace" | "bracelet" | "ring" | "earrings" | "other",
  "bodyPart":    one of "neckline" | "wrist" | "finger" | "ear" | "none",
  "placementNotes": one sentence of camera framing guidance, e.g. "sits at the wrist, camera should frame the hand and forearm with a close crop"
}

Type → body part mapping:
  necklace  → neckline
  bracelet  → wrist
  ring      → finger
  earrings  → ear
  other     → none`;

// Returned when GPT-4o is unavailable or times out — allows the rest of the
// pipeline to continue unchanged.
export const VISION_FALLBACK: ProductAnalysis = {
  productType: "other",
  bodyPart: "neckline",
  placementNotes: "default centre-frame placement",
};

const VALID_PRODUCT_TYPES = new Set<string>([
  "necklace", "bracelet", "ring", "earrings", "other",
]);
const VALID_BODY_PARTS = new Set<string>([
  "neckline", "wrist", "finger", "ear", "none",
]);

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeProduct(
  imageUrl: string,
  log: Logger,
): Promise<ProductAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("[vision] OPENAI_API_KEY not set — using fallback");
    return VISION_FALLBACK;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    log(`[vision] GPT-4o analysing product: ${imageUrl.slice(0, 70)}…`);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        max_tokens: 200,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "low" },
              },
              {
                type: "text",
                text: "Classify this jewellery product and provide placement guidance.",
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      log(
        `[vision] GPT-4o HTTP ${res.status}: ${txt.slice(0, 200)} — using fallback`,
      );
      return VISION_FALLBACK;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      log("[vision] GPT-4o returned empty content — using fallback");
      return VISION_FALLBACK;
    }

    const parsed = JSON.parse(content) as Partial<ProductAnalysis>;

    const productType = VALID_PRODUCT_TYPES.has(parsed.productType ?? "")
      ? (parsed.productType as JewelleryProductType)
      : "other";
    const bodyPart = VALID_BODY_PARTS.has(parsed.bodyPart ?? "")
      ? (parsed.bodyPart as BodyPart)
      : "neckline";
    const placementNotes =
      typeof parsed.placementNotes === "string" && parsed.placementNotes.length > 0
        ? parsed.placementNotes
        : VISION_FALLBACK.placementNotes;

    const result: ProductAnalysis = { productType, bodyPart, placementNotes };
    log(
      `[vision] result — productType=${productType} bodyPart=${bodyPart} placementNotes="${placementNotes}"`,
    );
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    log(
      `[vision] GPT-4o ${isTimeout ? "timed out" : `failed: ${msg}`} — using fallback`,
    );
    return VISION_FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}
