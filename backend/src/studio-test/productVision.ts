/**
 * productVision.ts — Two-stage Creative Director pipeline
 *
 * Stage 1 — Product Inspector  (GPT-4o vision, detail:"high", 45 s)
 *   Reads the image with gemologist-level precision: metal, stones,
 *   finish, design language, crafting technique, price tier, USPs.
 *
 * Stage 2 — Creative Brief Writer  (GPT-4o text-only, 35 s)
 *   Receives the full inspection JSON + brand context.
 *   Writes headline, subheadline, CTA, trustBullets, postType, storyAngle
 *   — all grounded in the inspection, no generic filler.
 *
 * Total time: 60–90 seconds. Quality over speed — intentional.
 *
 * Self-contained: imports NOTHING from the existing service pipeline.
 */

type Logger = (msg: string) => void;

// ─── Public types ─────────────────────────────────────────────────────────────

export type JewelleryProductType =
  | "necklace" | "bracelet" | "ring" | "earrings" | "other";

export type BodyPart = "neckline" | "wrist" | "finger" | "ear" | "none";

export type PostType = "lifestyle" | "product_highlight";

export interface CreativeAnalysis {
  productType:    JewelleryProductType;
  bodyPart:       BodyPart;
  placementNotes: string;
  postType:       PostType;
  storyAngle:     string;
  headline:       string;
  subheadline:    string;
  cta:            string;
  trustBullets:   string[];
}

// ─── Private types ────────────────────────────────────────────────────────────

interface ProductInspection {
  jewelType:        JewelleryProductType;
  bodyPart:         BodyPart;
  metalType:        string;
  metalFinish:      string;
  stones:           string[];
  designStyle:      string;
  craftingDetails:  string;
  priceTier:        string;
  targetAudience:   string;
  emotionalMeaning: string;
  usps:             string[];   // 3-5 factual phrases visible in the image
}

interface CreativeBrief {
  postType:       PostType;
  storyAngle:     string;
  headline:       string;
  subheadline:    string;
  cta:            string;
  trustBullets:   string[];
  placementNotes: string;
}

// ─── Timeouts ─────────────────────────────────────────────────────────────────

const INSPECT_TIMEOUT_MS = 45_000;   // vision + high detail — model takes time
const BRIEF_TIMEOUT_MS   = 35_000;   // text only — faster, but still thorough

// ─── Stage 1 prompt ───────────────────────────────────────────────────────────

const INSPECTOR_SYSTEM = `You are a senior gemologist and luxury product analyst at a top jewellery house.
Your task is to study a jewellery product photograph with extreme scientific precision.

Inspect the image tile by tile. Document every observable detail:

1. JEWELLERY TYPE — what kind of piece, which body part it is naturally worn on
2. METAL — colour, tone, estimated alloy (yellow gold / rose gold / white gold / sterling silver / oxidised silver / brass / platinum). Be specific.
3. FINISH — high-polish / brushed matte / hammered / oxidised / rhodium-plated / textured / engraved
4. STONES — for every visible stone: colour, probable type (diamond / blue topaz / sapphire / ruby / emerald / marcasite / CZ / pearl / onyx etc.), cut shape (round / teardrop / oval / marquise / square / cabochon), setting style (pavé / prong / bezel / channel / cluster / invisible)
5. DESIGN LANGUAGE — geometric / floral / art-deco / antique / minimalist / statement / bohemian / bridal / religious / nature-inspired
6. CRAFTING TECHNIQUE — filigree / pavé / hand-engraved / cast / twisted wire / open-work / laser-cut / stone-inlay
7. PRICE TIER — entry / mid / premium / luxury (judge by complexity + apparent material quality)
8. TARGET AUDIENCE — who buys this piece, for what occasion
9. EMOTIONAL MEANING — what feeling or milestone does this piece represent
10. UNIQUE SELLING POINTS — 3 to 5 short factual phrases that describe what makes THIS piece special, derived purely from what you can observe. These will become trust bullets. Format: "925 Sterling Silver", "Pavé-Set Marcasite", "Art Deco Crescent Design", "Hand-Set Blue Topaz". Never invent facts not visible.

Return ONLY a valid JSON object with these exact keys — no markdown, no commentary:
{
  "jewelType":        "necklace" | "bracelet" | "ring" | "earrings" | "other",
  "bodyPart":         "neckline" | "wrist" | "finger" | "ear" | "none",
  "metalType":        "...",
  "metalFinish":      "...",
  "stones":           ["...", "..."],
  "designStyle":      "...",
  "craftingDetails":  "...",
  "priceTier":        "entry" | "mid" | "premium" | "luxury",
  "targetAudience":   "...",
  "emotionalMeaning": "...",
  "usps":             ["...", "...", "...", "..."]
}`;

// ─── Stage 2 prompt ───────────────────────────────────────────────────────────

const DIRECTOR_SYSTEM = `You are the Creative Director at a luxury jewellery marketing studio.
A gemologist has just handed you a detailed inspection report for a product.
You also have the client's brand brief.

Your job: write a complete Instagram ad creative brief grounded entirely in the inspection findings.

STRICT RULES:
— Every field must be specific to THIS piece. Generic phrases ("quality jewellery", "for every moment") are forbidden.
— headline and subheadline must each use at least one brand tone adjective from the brief.
— trustBullets must be rephrased from the usps in the inspection — you may reword for elegance but must never invent facts.
— postType decision: choose "product_highlight" when craftsmanship / material / design detail is the hero (statement pieces, intricate work, unusual stones). Choose "lifestyle" when the emotional story or personal moment is the hero (delicate daily wear, gifts, milestone pieces).
— cta matches postType: lifestyle → "Wear the Story" / "Feel the Moment" / "Own the Memory"; product → "Shop Now" / "Discover the Craft" / "Explore the Collection".

Return ONLY a valid JSON object with these exact keys — no markdown, no extra keys:
{
  "postType":       "lifestyle" | "product_highlight",
  "storyAngle":     "3–6 words capturing the emotional or aesthetic angle",
  "headline":       "3–7 word Instagram headline",
  "subheadline":    "10–16 word supporting sentence",
  "cta":            "2–3 word call-to-action",
  "trustBullets":   ["...", "...", "...", "..."] if product_highlight, else [],
  "placementNotes": "one sentence of composition / framing guidance for the composited image"
}`;

// ─── Fallback ─────────────────────────────────────────────────────────────────

export const CREATIVE_FALLBACK: CreativeAnalysis = {
  productType:    "other",
  bodyPart:       "neckline",
  placementNotes: "centre-frame product placement",
  postType:       "product_highlight",
  storyAngle:     "everyday elegance",
  headline:       "Crafted to Last",
  subheadline:    "Premium jewellery for every precious moment",
  cta:            "Shop Now",
  trustBullets:   [],
};

// ─── Validation ────────────────────────────────────────────────────────────────

const VALID_PRODUCT_TYPES = new Set<string>(["necklace","bracelet","ring","earrings","other"]);
const VALID_BODY_PARTS    = new Set<string>(["neckline","wrist","finger","ear","none"]);
const VALID_POST_TYPES    = new Set<string>(["lifestyle","product_highlight"]);

// ─── GPT-4o fetch helper ──────────────────────────────────────────────────────

async function gptJson<T>(
  apiKey:    string,
  systemMsg: string,
  userContent: unknown[],
  maxTokens: number,
  timeoutMs: number,
  tag:       string,
  log:       Logger,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    log(`[creative] ${tag} — submitting to GPT-4o…`);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:           "gpt-4o",
        response_format: { type: "json_object" },
        max_tokens:      maxTokens,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user",   content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      log(`[creative] ${tag} HTTP ${res.status}: ${txt.slice(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?:   { total_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) { log(`[creative] ${tag} — empty response`); return null; }

    log(`[creative] ${tag} — tokens used: ${data.usage?.total_tokens ?? "?"}`);
    return JSON.parse(content) as T;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    log(`[creative] ${tag} — ${isTimeout ? "timed out" : (err instanceof Error ? err.message : String(err))}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Stage 1 — Product Inspector ─────────────────────────────────────────────

async function inspectProduct(
  apiKey:   string,
  imageUrl: string,
  log:      Logger,
): Promise<ProductInspection | null> {
  const raw = await gptJson<Record<string, unknown>>(
    apiKey,
    INSPECTOR_SYSTEM,
    [
      {
        type:      "image_url",
        // "high" — GPT-4o tiles the full image for fine detail
        image_url: { url: imageUrl, detail: "high" },
      },
      {
        type: "text",
        text: "Study every pixel of this jewellery product image. Take your time — " +
              "document the metal, stones, finish, crafting technique, and all unique details " +
              "before writing anything. Accuracy is everything.",
      },
    ],
    800,
    INSPECT_TIMEOUT_MS,
    "Stage 1 — Inspect",
    log,
  );

  if (!raw) return null;

  const str    = (v: unknown, fb: string) => typeof v === "string" && v.length > 0 ? v : fb;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];

  return {
    jewelType:
      VALID_PRODUCT_TYPES.has(String(raw.jewelType ?? ""))
        ? (raw.jewelType as JewelleryProductType)
        : "other",
    bodyPart:
      VALID_BODY_PARTS.has(String(raw.bodyPart ?? ""))
        ? (raw.bodyPart as BodyPart)
        : "none",
    metalType:        str(raw.metalType,        "unknown metal"),
    metalFinish:      str(raw.metalFinish,       "polished"),
    stones:           strArr(raw.stones),
    designStyle:      str(raw.designStyle,       "contemporary"),
    craftingDetails:  str(raw.craftingDetails,   "precision-crafted"),
    priceTier:        str(raw.priceTier,         "mid"),
    targetAudience:   str(raw.targetAudience,    "jewellery lovers"),
    emotionalMeaning: str(raw.emotionalMeaning,  "self-expression"),
    usps:             strArr(raw.usps).slice(0, 5),
  };
}

// ─── Stage 2 — Creative Brief Writer ─────────────────────────────────────────

async function generateBrief(
  apiKey:     string,
  inspection: ProductInspection,
  brandName:  string,
  brandTone:  string[],
  brandHex:   string[],
  log:        Logger,
): Promise<CreativeBrief | null> {
  const inspectionText = JSON.stringify(inspection, null, 2);

  const raw = await gptJson<Record<string, unknown>>(
    apiKey,
    DIRECTOR_SYSTEM,
    [
      {
        type: "text",
        text:
          `Brand name: ${brandName}\n` +
          `Brand tone adjectives: ${brandTone.join(", ")}\n` +
          `Brand colours: ${brandHex.join(", ")}\n\n` +
          `GEMOLOGIST INSPECTION REPORT:\n${inspectionText}\n\n` +
          "Write the Instagram ad creative brief. Every word must be grounded in the inspection. " +
          "Trust bullets must come from the usps above. Take your time — write copy that feels earned.",
      },
    ],
    600,
    BRIEF_TIMEOUT_MS,
    "Stage 2 — Brief",
    log,
  );

  if (!raw) return null;

  const str    = (v: unknown, fb: string) => typeof v === "string" && v.length > 0 ? v : fb;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];

  const postType: PostType =
    VALID_POST_TYPES.has(String(raw.postType ?? ""))
      ? (raw.postType as PostType)
      : "product_highlight";

  return {
    postType,
    storyAngle:     str(raw.storyAngle,     CREATIVE_FALLBACK.storyAngle),
    headline:       str(raw.headline,        CREATIVE_FALLBACK.headline),
    subheadline:    str(raw.subheadline,     CREATIVE_FALLBACK.subheadline),
    cta:            str(raw.cta,             CREATIVE_FALLBACK.cta),
    trustBullets:
      postType === "product_highlight"
        ? strArr(raw.trustBullets).slice(0, 4)
        : [],
    placementNotes: str(raw.placementNotes, CREATIVE_FALLBACK.placementNotes),
  };
}

// ─── Public: analyzeCreative ──────────────────────────────────────────────────

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

  log("[creative] ── Stage 1: inspecting product image (high-detail vision)…");
  const inspection = await inspectProduct(apiKey, imageUrl, log);

  if (!inspection) {
    log("[creative] Stage 1 failed — using fallback");
    return CREATIVE_FALLBACK;
  }

  log(
    `[creative] Stage 1 done — ${inspection.jewelType} | metal: ${inspection.metalType} | ` +
    `stones: ${inspection.stones.join(", ") || "none"} | usps: ${inspection.usps.join(" · ")}`,
  );

  log("[creative] ── Stage 2: writing creative brief from inspection…");
  const brief = await generateBrief(apiKey, inspection, brandName, brandTone, brandHex, log);

  if (!brief) {
    log("[creative] Stage 2 failed — using fallback with inspection productType/bodyPart");
    return {
      ...CREATIVE_FALLBACK,
      productType: inspection.jewelType,
      bodyPart:    inspection.bodyPart,
    };
  }

  log(
    `[creative] Stage 2 done — postType=${brief.postType} headline="${brief.headline}" ` +
    `bullets=${JSON.stringify(brief.trustBullets)}`,
  );

  return {
    productType:    inspection.jewelType,
    bodyPart:       inspection.bodyPart,
    placementNotes: brief.placementNotes,
    postType:       brief.postType,
    storyAngle:     brief.storyAngle,
    headline:       brief.headline,
    subheadline:    brief.subheadline,
    cta:            brief.cta,
    trustBullets:   brief.trustBullets,
  };
}
