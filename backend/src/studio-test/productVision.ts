/**
 * productVision.ts — two-stage Creative Director.
 *
 * Stage 1  Product Inspector  (GPT-4o vision, detail:"high")
 *          gemologist-grade read of the product: metal, stones, finish, style, USPs, orientation.
 *
 * Stage 2  Art Director       (GPT-4o text)
 *          picks from the design-system MENU (layout, font pairing, scene mood, icons)
 *          and writes copy grounded in the inspection. Rules live here; the renderer
 *          is deterministic, so the "if this then that" is enforced in code and validation.
 */

import {
  LAYOUT_IDS, FONT_PAIRING_IDS, ICON_IDS, sceneMoodsFor, isIconId,
  type LayoutId, type FontPairingId,
} from "./designSystem";

type Logger = (msg: string) => void;

// ─── Public types ─────────────────────────────────────────────────────────────

export type JewelleryProductType = "necklace" | "bracelet" | "ring" | "earrings" | "other";
export type BodyPart  = "neckline" | "wrist" | "finger" | "ear" | "none";
export type PostType  = "lifestyle" | "product_highlight";
export type Orientation = "tall" | "wide" | "square";

export interface CreativeAnalysis {
  productType:    JewelleryProductType;
  bodyPart:       BodyPart;
  orientation:    Orientation;
  placementNotes: string;
  postType:       PostType;
  storyAngle:     string;
  headline:       string;
  accentLine:     string;
  subheadline:    string;
  cta:            string;
  trustBullets:   string[];
  trustIcons:     string[];
  layoutId:       LayoutId;
  fontPairingId:  FontPairingId;
  sceneMood:      string;
}

// ─── Private types ────────────────────────────────────────────────────────────

interface ProductInspection {
  jewelType:        JewelleryProductType;
  bodyPart:         BodyPart;
  orientation:      Orientation;
  metalType:        string;
  metalFinish:      string;
  stones:           string[];
  dominantColours:  string[];
  designStyle:      string;
  craftingDetails:  string;
  priceTier:        string;
  targetAudience:   string;
  emotionalMeaning: string;
  usps:             string[];
}

interface CreativeBrief {
  postType:      PostType;
  layoutId:      LayoutId;
  fontPairingId: FontPairingId;
  sceneMood:     string;
  storyAngle:    string;
  headline:      string;
  accentLine:    string;
  subheadline:   string;
  cta:           string;
  trustBullets:  { text: string; icon: string }[];
  placementNotes: string;
}

const INSPECT_TIMEOUT_MS = 45_000;
const BRIEF_TIMEOUT_MS   = 40_000;

// ─── Stage 1 prompt ───────────────────────────────────────────────────────────

const INSPECTOR_SYSTEM = `You are a senior gemologist and luxury product analyst.
Study the product photograph with scientific precision, tile by tile, and document:

1. TYPE — kind of piece and the body part it is worn on (or "none" for non-wearables)
2. ORIENTATION — the product's silhouette: "tall" (height clearly > width, e.g. drop earrings, pendants, bottles),
   "wide" (width clearly > height, e.g. a ring lying flat, a plate, a bracelet laid out), or "square"
3. METAL — colour, tone, likely alloy (yellow / rose / white gold, sterling silver, oxidised silver, brass, platinum)
4. FINISH — high-polish / brushed / hammered / oxidised / rhodium / textured / engraved
5. STONES — for each visible stone: colour, probable type, cut, setting
6. DOMINANT COLOURS — 2–3 colour words that describe the product (e.g. "rose gold", "white", "deep red")
7. DESIGN LANGUAGE — geometric / floral / art-deco / antique / minimalist / statement / bridal / nature-inspired
8. CRAFTING — filigree / pavé / hand-engraved / cast / open-work / stone-inlay
9. PRICE TIER — entry / mid / premium / luxury
10. AUDIENCE and EMOTIONAL MEANING — who buys it, for what moment, what it says
11. USPs — 3 to 5 short factual phrases (≤4 words each) visible in the image, e.g. "925 Sterling Silver",
    "Pavé-Set Marcasite", "Hand-Set Blue Topaz". Never invent facts.

Return ONLY valid JSON:
{
  "jewelType": "necklace"|"bracelet"|"ring"|"earrings"|"other",
  "bodyPart": "neckline"|"wrist"|"finger"|"ear"|"none",
  "orientation": "tall"|"wide"|"square",
  "metalType": "...", "metalFinish": "...",
  "stones": ["..."], "dominantColours": ["..."],
  "designStyle": "...", "craftingDetails": "...",
  "priceTier": "entry"|"mid"|"premium"|"luxury",
  "targetAudience": "...", "emotionalMeaning": "...",
  "usps": ["...", "...", "..."]
}`;

// ─── Stage 2 prompt ───────────────────────────────────────────────────────────

function directorSystem(industry: string, locale: string): string {
  const moods = sceneMoodsFor(industry);
  return `You are the Art Director at a luxury advertising studio. A gemologist's inspection report and the
client's brand brief are attached. Produce ONE Instagram post brief by choosing from the fixed MENU below
and writing copy that is specific to THIS product. The renderer is deterministic — it will draw exactly
what you specify, so choose carefully.

══ MENU ══
layoutId       : ${LAYOUT_IDS.join(" | ")}
fontPairingId  : ${FONT_PAIRING_IDS.join(" | ")}
sceneMood      : ${moods.join(" | ")}
icon ids       : ${ICON_IDS.join(", ")}

══ RULES ══
LAYOUT  — orientation "tall"  → text_left_product_right or text_right_product_left.
          orientation "wide"  → text_top_product_bottom.
          orientation "square"→ centered_hero or text_left_product_right.
FONTS   — luxury / bridal / heritage feel → luxury_serif or refined_serif or editorial_bold.
          food / warm / playful → friendly_rounded or classic_editorial.
          modern / tech / minimalist lifestyle → modern_geometric or editorial_bold.
SCENE   — pick the mood whose backdrop flatters the product's dominant colours:
          rose gold / pink stones → romantic or warm; silver / white stones → royal or classic or fresh;
          yellow gold → classic, emerald or warm; colourful stones → classic (dark neutral) so stones pop.
HEADLINE— 2 to 4 words. Emotional, NOT a description. Never the product type or the word "premium".
          Good: "Do Dil. Ek Vaada." / "Worn, Not Kept." / "Light That Lingers" / "Made For Yes".
          Locale ${locale}: if IN and the tone is warm, romantic or festive, a short Hinglish line in Roman
          script is welcome and often stronger.
ACCENT  — optional 1–3 word punch that follows the headline on its own italic line in the accent colour
          (e.g. headline "Do Dil." accent "Ek Vaada."). Use "" when the headline already lands alone.
SUB     — 6 to 12 words. One idea. Plain, human, no adjectives stacked.
TRUST   — product_highlight: exactly 3 bullets, each ≤4 words, rephrased from inspection.usps, each with the
          most fitting icon id from the menu. lifestyle: [].
POSTTYPE— product_highlight when material / craft / stones are the hero; lifestyle when the moment is.
CTA     — 2–3 words, kept for the caption.
FORBIDDEN— "quality", "elegant", "exquisite", "premium", "perfect for every occasion", generic filler.

Return ONLY valid JSON with exactly these keys:
{
  "postType": "lifestyle"|"product_highlight",
  "layoutId": "...", "fontPairingId": "...", "sceneMood": "...",
  "storyAngle": "3–6 words",
  "headline": "...", "accentLine": "...", "subheadline": "...", "cta": "...",
  "trustBullets": [{"text": "...", "icon": "..."}],
  "placementNotes": "one sentence"
}`;
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

export const CREATIVE_FALLBACK: CreativeAnalysis = {
  productType:    "other",
  bodyPart:       "none",
  orientation:    "tall",
  placementNotes: "centre-frame product placement",
  postType:       "product_highlight",
  storyAngle:     "quiet confidence",
  headline:       "Made To Be Noticed.",
  accentLine:     "",
  subheadline:    "Crafted for the moments you want to remember.",
  cta:            "Shop Now",
  trustBullets:   [],
  trustIcons:     [],
  layoutId:       "text_left_product_right",
  fontPairingId:  "luxury_serif",
  sceneMood:      "classic",
};

// ─── Validation sets ──────────────────────────────────────────────────────────

const VALID_PRODUCT = new Set<string>(["necklace", "bracelet", "ring", "earrings", "other"]);
const VALID_BODY    = new Set<string>(["neckline", "wrist", "finger", "ear", "none"]);
const VALID_POST    = new Set<string>(["lifestyle", "product_highlight"]);
const VALID_ORIENT  = new Set<string>(["tall", "wide", "square"]);

const str    = (v: unknown, fb: string) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : fb);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];

// ─── GPT-4o JSON helper ───────────────────────────────────────────────────────

async function gptJson<T>(
  apiKey: string, systemMsg: string, userContent: unknown[],
  maxTokens: number, timeoutMs: number, tag: string, log: Logger,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    log(`[creative] ${tag} — submitting to GPT-4o…`);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user",   content: userContent },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      log(`[creative] ${tag} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) { log(`[creative] ${tag} — empty response`); return null; }
    log(`[creative] ${tag} — tokens used: ${data.usage?.total_tokens ?? "?"}`);
    return JSON.parse(content) as T;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    log(`[creative] ${tag} — ${isTimeout ? "timed out" : err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Stage 1 ──────────────────────────────────────────────────────────────────

async function inspectProduct(apiKey: string, imageUrl: string, log: Logger): Promise<ProductInspection | null> {
  const raw = await gptJson<Record<string, unknown>>(
    apiKey, INSPECTOR_SYSTEM,
    [
      { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
      { type: "text", text: "Study every pixel. Document metal, stones, finish, craft, silhouette orientation and all unique details before writing. Accuracy is everything." },
    ],
    900, INSPECT_TIMEOUT_MS, "Stage 1 — Inspect", log,
  );
  if (!raw) return null;

  return {
    jewelType:        VALID_PRODUCT.has(String(raw.jewelType))  ? (raw.jewelType as JewelleryProductType) : "other",
    bodyPart:         VALID_BODY.has(String(raw.bodyPart))      ? (raw.bodyPart as BodyPart) : "none",
    orientation:      VALID_ORIENT.has(String(raw.orientation)) ? (raw.orientation as Orientation) : "tall",
    metalType:        str(raw.metalType, "unknown metal"),
    metalFinish:      str(raw.metalFinish, "polished"),
    stones:           strArr(raw.stones),
    dominantColours:  strArr(raw.dominantColours),
    designStyle:      str(raw.designStyle, "contemporary"),
    craftingDetails:  str(raw.craftingDetails, "precision-crafted"),
    priceTier:        str(raw.priceTier, "mid"),
    targetAudience:   str(raw.targetAudience, "jewellery lovers"),
    emotionalMeaning: str(raw.emotionalMeaning, "self-expression"),
    usps:             strArr(raw.usps).slice(0, 5),
  };
}

// ─── Stage 2 ──────────────────────────────────────────────────────────────────

async function generateBrief(
  apiKey: string, inspection: ProductInspection,
  brandName: string, brandTone: string[], brandHex: string[],
  industry: string, locale: string, log: Logger,
): Promise<CreativeBrief | null> {
  const raw = await gptJson<Record<string, unknown>>(
    apiKey, directorSystem(industry, locale),
    [{
      type: "text",
      text:
        `Brand: ${brandName}\nIndustry: ${industry}\nTone: ${brandTone.join(", ")}\n` +
        `Brand colours: ${brandHex.join(", ")}\nLocale: ${locale}\n\n` +
        `INSPECTION REPORT:\n${JSON.stringify(inspection, null, 2)}\n\n` +
        "Choose from the menu and write the brief. Every word must be earned by the inspection.",
    }],
    700, BRIEF_TIMEOUT_MS, "Stage 2 — Art Direction", log,
  );
  if (!raw) return null;

  const moods    = sceneMoodsFor(industry);
  const postType: PostType = VALID_POST.has(String(raw.postType)) ? (raw.postType as PostType) : "product_highlight";

  const bulletsRaw = Array.isArray(raw.trustBullets) ? (raw.trustBullets as unknown[]) : [];
  const trustBullets = bulletsRaw
    .map((b) => {
      if (typeof b === "string") return { text: b.trim(), icon: "sparkles" };
      if (b && typeof b === "object") {
        const o = b as Record<string, unknown>;
        return { text: str(o.text, ""), icon: isIconId(o.icon) ? o.icon : "sparkles" };
      }
      return { text: "", icon: "sparkles" };
    })
    .filter((b) => b.text.length > 0)
    .slice(0, 3);

  return {
    postType,
    layoutId:      (LAYOUT_IDS as string[]).includes(String(raw.layoutId)) ? (raw.layoutId as LayoutId) : "text_left_product_right",
    fontPairingId: (FONT_PAIRING_IDS as string[]).includes(String(raw.fontPairingId)) ? (raw.fontPairingId as FontPairingId) : "luxury_serif",
    sceneMood:     moods.includes(String(raw.sceneMood)) ? String(raw.sceneMood) : moods[0],
    storyAngle:    str(raw.storyAngle, CREATIVE_FALLBACK.storyAngle),
    headline:      str(raw.headline, CREATIVE_FALLBACK.headline),
    accentLine:    typeof raw.accentLine === "string" ? raw.accentLine.trim() : "",
    subheadline:   str(raw.subheadline, CREATIVE_FALLBACK.subheadline),
    cta:           str(raw.cta, CREATIVE_FALLBACK.cta),
    trustBullets:  postType === "product_highlight" ? trustBullets : [],
    placementNotes: str(raw.placementNotes, CREATIVE_FALLBACK.placementNotes),
  };
}

// ─── Public ───────────────────────────────────────────────────────────────────

export async function analyzeCreative(input: {
  imageUrl:  string;
  brandName: string;
  brandTone: string[];
  brandHex:  string[];
  industry:  string;
  locale:    string;
  log:       Logger;
}): Promise<CreativeAnalysis> {
  const { imageUrl, brandName, brandTone, brandHex, industry, locale, log } = input;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { log("[creative] OPENAI_API_KEY not set — using fallback"); return CREATIVE_FALLBACK; }

  log("[creative] ── Stage 1: inspecting product (high-detail vision)…");
  const inspection = await inspectProduct(apiKey, imageUrl, log);
  if (!inspection) { log("[creative] Stage 1 failed — using fallback"); return CREATIVE_FALLBACK; }
  log(
    `[creative] Stage 1 done — ${inspection.jewelType} ${inspection.orientation} | ${inspection.metalType} | ` +
    `stones: ${inspection.stones.join(", ") || "none"} | usps: ${inspection.usps.join(" · ")}`,
  );

  log("[creative] ── Stage 2: art direction from inspection…");
  const brief = await generateBrief(apiKey, inspection, brandName, brandTone, brandHex, industry, locale, log);
  if (!brief) {
    log("[creative] Stage 2 failed — fallback copy with inspection facts");
    return { ...CREATIVE_FALLBACK, productType: inspection.jewelType, bodyPart: inspection.bodyPart, orientation: inspection.orientation };
  }
  log(
    `[creative] Stage 2 done — layout=${brief.layoutId} fonts=${brief.fontPairingId} scene=${brief.sceneMood} ` +
    `headline="${brief.headline}" accent="${brief.accentLine}" bullets=${JSON.stringify(brief.trustBullets)}`,
  );

  return {
    productType:    inspection.jewelType,
    bodyPart:       inspection.bodyPart,
    orientation:    inspection.orientation,
    placementNotes: brief.placementNotes,
    postType:       brief.postType,
    storyAngle:     brief.storyAngle,
    headline:       brief.headline,
    accentLine:     brief.accentLine,
    subheadline:    brief.subheadline,
    cta:            brief.cta,
    trustBullets:   brief.trustBullets.map((b) => b.text),
    trustIcons:     brief.trustBullets.map((b) => b.icon),
    layoutId:       brief.layoutId,
    fontPairingId:  brief.fontPairingId,
    sceneMood:      brief.sceneMood,
  };
}
