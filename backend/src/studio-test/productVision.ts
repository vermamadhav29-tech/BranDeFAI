/**
 * productVision.ts — two-stage Creative Director, branched per industry.
 *
 * Stage 1  Product Inspector  (GPT-4o vision, detail:"high")
 *          An industry-appropriate expert reads the product photo into a common
 *          schema (productType, materials, finish, USPs, ...) so Stage 2 and the
 *          renderer never need to know which industry they're looking at.
 *
 * Stage 2  Art Director       (GPT-4o text)
 *          picks from the design-system MENU (layout, font pairing, scene mood,
 *          icons) and writes copy grounded in the inspection. Rules live here;
 *          the renderer is deterministic, so the "if this then that" is enforced
 *          in code + validation, not in an ever-longer prompt.
 *
 * Industries: must match designSystem.INDUSTRY_SCENES keys and
 * services/promptTemplates/industryTemplates.ts industryKeys.
 */

import {
  LAYOUT_IDS, FONT_PAIRING_IDS, ICON_IDS, sceneMoodsFor, isIconId,
  type LayoutId, type FontPairingId,
} from "./designSystem";

type Logger = (msg: string) => void;

// ─── Public types ─────────────────────────────────────────────────────────────

export type Industry    = "jewellery" | "food_desserts" | "lifestyle";
export type PostType    = "lifestyle" | "product_highlight";
export type Orientation = "tall" | "wide" | "square";

export interface CreativeAnalysis {
  productType:      string;   // free text, industry-appropriate: "drop earrings", "chocolate lava cake", "ceramic diffuser"
  orientation:      Orientation;
  placementNotes:   string;
  postType:         PostType;
  storyAngle:        string;
  headline:          string;
  accentLine:        string;
  subheadline:       string;
  cta:               string;
  trustBullets:      string[];
  trustIcons:        string[];
  layoutId:          LayoutId;
  fontPairingId:     FontPairingId;
  sceneMood:         string;   // fallback tag for the pre-rendered library, used if live generation fails
  sceneDescription:  string;   // bespoke backdrop description, drives live Flux generation
}

// ─── Private types ────────────────────────────────────────────────────────────

interface ProductInspection {
  productType:      string;    // e.g. "drop earrings" | "chocolate lava cake" | "ceramic desk diffuser"
  orientation:      Orientation;
  materials:        string[];  // metal+stones / ingredients+garnish / materials+components — industry-appropriate
  finish:           string;    // metal finish / glaze+texture / surface finish
  dominantColours:  string[];
  designStyle:      string;
  craftingDetails:  string;
  priceTier:        string;
  targetAudience:   string;
  emotionalMeaning: string;
  usps:             string[];  // 3-5 factual phrases visible in the image
}

interface CreativeBrief {
  postType:         PostType;
  layoutId:         LayoutId;
  fontPairingId:    FontPairingId;
  sceneMood:        string;
  sceneDescription: string;
  storyAngle:       string;
  headline:         string;
  accentLine:       string;
  subheadline:      string;
  cta:              string;
  trustBullets:     { text: string; icon: string }[];
  placementNotes:   string;
}

const INSPECT_TIMEOUT_MS = 45_000;
const BRIEF_TIMEOUT_MS   = 40_000;

// ─── Stage 1 prompts (per industry) ────────────────────────────────────────────

const INSPECTOR_SCHEMA_JSON = `{
  "productType": "...",
  "orientation": "tall"|"wide"|"square",
  "materials": ["...", "..."],
  "finish": "...",
  "dominantColours": ["...", "..."],
  "designStyle": "...",
  "craftingDetails": "...",
  "priceTier": "entry"|"mid"|"premium"|"luxury",
  "targetAudience": "...",
  "emotionalMeaning": "...",
  "usps": ["...", "...", "..."]
}`;

export function inspectorSystemFor(industry: Industry): string {
  const shared =
    `ORIENTATION is the product's silhouette in the photo: "tall" (height clearly > width), ` +
    `"wide" (width clearly > height), or "square" (roughly equal). USPs are 3 to 5 short factual phrases ` +
    `(≤4 words each) visible in the image — never invent facts not visible. Return ONLY valid JSON with ` +
    `exactly these keys, no markdown, no commentary:\n${INSPECTOR_SCHEMA_JSON}`;

  if (industry === "food_desserts") {
    return `You are a pastry chef and food stylist analysing a product photograph with a chef's precision.
Study the image tile by tile and document:

1. PRODUCT TYPE — the specific dish/item by its precise common name, e.g. "chocolate lava cake", "strawberry tart", "cold brew latte" — not a generic category like "dessert"
2. MATERIALS — key visible ingredients and garnish (e.g. "70% dark chocolate", "fresh raspberries", "gold leaf", "salted caramel drizzle")
3. FINISH — glaze / frosting texture / plating finish (e.g. "glossy ganache glaze", "dusted icing sugar", "matte fondant")
4. DOMINANT COLOURS — 2–3 colour words that describe the dish
5. DESIGN STYLE — rustic / elegant / minimalist / indulgent / playful / artisanal
6. CRAFTING — visible technique (hand-piped, layered, torched, drizzled, dusted)
7. PRICE TIER — entry / mid / premium / luxury, judged by presentation and apparent ingredient quality
8. AUDIENCE and EMOTIONAL MEANING — who orders/bakes this, for what moment, what feeling it gives
9. USPs — factual, appetite-driving phrases visible in the image, e.g. "70% Belgian Dark Chocolate", "Fresh Raspberry Compote", "Hand-Piped Buttercream"

${shared}`;
  }

  if (industry === "lifestyle") {
    return `You are a senior product designer and stylist analysing a product photograph with a design critic's eye.
Study the image tile by tile and document:

1. PRODUCT TYPE — the specific item by its precise common name. If it depicts a deity, mythological or
   religious figure, or a recognisable cultural motif, NAME IT PRECISELY (e.g. "Ram Darbar idol", "Ganesha
   murti", "Buddha statue", "dragon figurine") — never default to a generic category like "decorative statue"
   when the specific subject is identifiable
2. MATERIALS — visible materials and components (e.g. "brushed aluminium", "full-grain leather", "recycled cotton canvas")
3. FINISH — surface finish (e.g. "matte anodised", "soft-touch rubber", "hand-stitched edge")
4. DOMINANT COLOURS — 2–3 colour words that describe the product
5. DESIGN STYLE — minimalist / industrial / organic / retro / tech-forward / artisanal
6. CRAFTING — visible technique (precision-milled, hand-stitched, injection-moulded, woven)
7. PRICE TIER — entry / mid / premium / luxury, judged by material and finish quality
8. AUDIENCE and EMOTIONAL MEANING — who buys this, for what use case, what it signals about them
9. USPs — factual phrases visible in the image, e.g. "Anodised Aluminium Shell", "FSC-Certified Oak", "Hand-Stitched Leather Strap"

${shared}`;
  }

  // jewellery (default)
  return `You are a senior gemologist and luxury product analyst analysing a jewellery photograph with scientific precision.
Study the image tile by tile and document:

1. PRODUCT TYPE — the specific piece and, in parentheses, the body part it's worn on (e.g. "drop earrings (ear)",
   "cocktail ring (finger)"; use "none" if not wearable). If the piece depicts a deity, mythological figure, or
   recognisable cultural/religious motif (e.g. a Krishna pendant, an Om charm), name it precisely instead of
   defaulting to a generic description
2. MATERIALS — metal (colour/tone/likely alloy: yellow/rose/white gold, sterling silver, oxidised silver, brass, platinum) AND every visible stone (colour, probable type, cut, setting) as separate entries
3. FINISH — high-polish / brushed / hammered / oxidised / rhodium / textured / engraved
4. DOMINANT COLOURS — 2–3 colour words (e.g. "rose gold", "white", "deep red")
5. DESIGN STYLE — geometric / floral / art-deco / antique / minimalist / statement / bridal / nature-inspired
6. CRAFTING — filigree / pavé / hand-engraved / cast / open-work / stone-inlay
7. PRICE TIER — entry / mid / premium / luxury
8. AUDIENCE and EMOTIONAL MEANING — who buys it, for what moment, what it says
9. USPs — factual phrases visible in the image, e.g. "925 Sterling Silver", "Pavé-Set Marcasite", "Hand-Set Blue Topaz"

${shared}`;
}

// ─── Stage 2 prompt ───────────────────────────────────────────────────────────

function sceneGuidanceFor(industry: Industry): string {
  const examples =
    industry === "food_desserts"
      ? `e.g. "dark walnut table, single shaft of warm afternoon light, faint steam" for a rich warm bake, or ` +
        `"pale marble counter, bright diffused daylight, a few scattered citrus peels" for a fresh fruity dessert`
      : industry === "lifestyle"
      ? `e.g. "brushed concrete plinth, single soft studio spotlight, deep charcoal background" for a technical ` +
        `product, or "warm oak shelf against a plastered wall, low golden-hour light" for an artisanal one — and ` +
        `for devotional or cultural pieces, a temple-shelf or mandap-inspired scene: warm carved wood or marble, ` +
        `soft diya-like glow`
      : `e.g. "deep royal-blue silk pooling in soft folds, single dramatic spotlight" for a bold statement piece, ` +
        `or "pale marble slab, soft window light, faint shadow" for a delicate everyday piece`;

  return (
    `SCENE   — write a bespoke, one-sentence backdrop description (12–22 words) for THIS specific product: ` +
    `surface/material, lighting, mood — grounded in its actual colours, materials and story, not a generic ` +
    `studio wall. It must describe an EMPTY surface/setting only — no props, no other objects, nothing that ` +
    `could be confused with the product itself. ${examples}. Also pick the closest sceneMood tag from the menu ` +
    `as a fallback label (used only if live generation of your description fails).`
  );
}

function headlineGuidanceFor(industry: Industry, locale: string): string {
  const base =
    `HEADLINE— 2 to 4 words. Emotional, NOT a description. Never the product type or the word "premium".`;
  if (industry === "food_desserts") {
    return `${base} Craving-driven and sensory. Good: "Rich. Warm. Yours." / "Baked This Morning" / "One More Bite" / "Melts First Bite".`;
  }
  if (industry === "lifestyle") {
    return `${base} Confident and functional. Good: "Built For Days Like This" / "Made To Move" / "Everyday, Elevated" / "Carry Less. Live More.".`;
  }
  return `${base} Good: "Do Dil. Ek Vaada." / "Worn, Not Kept." / "Light That Lingers" / "Made For Yes". ` +
    `Locale ${locale}: if IN and the tone is warm, romantic or festive, a short Hinglish line in Roman script is welcome and often stronger.`;
}

export function directorSystem(industry: Industry, locale: string): string {
  const moods = sceneMoodsFor(industry);
  return `You are the Art Director at a luxury advertising studio. A product inspection report and the
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
${sceneGuidanceFor(industry)}
${headlineGuidanceFor(industry, locale)}
ACCENT  — optional 1–3 word punch that follows the headline on its own italic line in the accent colour
          (e.g. headline "Do Dil." accent "Ek Vaada."). Use "" when the headline already lands alone.
SUB     — 6 to 12 words. One idea. Plain, human, no adjectives stacked.
TRUST   — product_highlight: exactly 3 bullets, each ≤4 words, rephrased from inspection.usps, each with the
          most fitting icon id from the menu. lifestyle: [].
POSTTYPE— product_highlight when material / craft / detail is the hero; lifestyle when the moment is.
CTA     — 2–3 words, kept for the caption.
FORBIDDEN— "quality", "elegant", "exquisite", "premium", "perfect for every occasion", generic filler.

Return ONLY valid JSON with exactly these keys:
{
  "postType": "lifestyle"|"product_highlight",
  "layoutId": "...", "fontPairingId": "...", "sceneMood": "...",
  "sceneDescription": "12–22 word bespoke empty-backdrop description",
  "storyAngle": "3–6 words",
  "headline": "...", "accentLine": "...", "subheadline": "...", "cta": "...",
  "trustBullets": [{"text": "...", "icon": "..."}],
  "placementNotes": "one sentence"
}`;
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

export const CREATIVE_FALLBACK: CreativeAnalysis = {
  productType:    "product",
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
  layoutId:         "text_left_product_right",
  fontPairingId:    "luxury_serif",
  sceneMood:        "classic",
  sceneDescription: "black velvet fabric surface with a subtle sheen, dark moody vignette",
};

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_POST   = new Set<string>(["lifestyle", "product_highlight"]);
const VALID_ORIENT = new Set<string>(["tall", "wide", "square"]);

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

async function inspectProduct(
  apiKey: string, imageUrl: string, industry: Industry, log: Logger,
): Promise<ProductInspection | null> {
  const raw = await gptJson<Record<string, unknown>>(
    apiKey, inspectorSystemFor(industry),
    [
      { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
      { type: "text", text: "Study every pixel. Document materials, finish, craft, silhouette orientation and all unique details before writing. Accuracy is everything." },
    ],
    900, INSPECT_TIMEOUT_MS, "Stage 1 — Inspect", log,
  );
  if (!raw) return null;

  return {
    productType:      str(raw.productType, "product"),
    orientation:      VALID_ORIENT.has(String(raw.orientation)) ? (raw.orientation as Orientation) : "tall",
    materials:        strArr(raw.materials),
    finish:           str(raw.finish, "unknown finish"),
    dominantColours:  strArr(raw.dominantColours),
    designStyle:      str(raw.designStyle, "contemporary"),
    craftingDetails:  str(raw.craftingDetails, "carefully made"),
    priceTier:        str(raw.priceTier, "mid"),
    targetAudience:   str(raw.targetAudience, "discerning customers"),
    emotionalMeaning: str(raw.emotionalMeaning, "self-expression"),
    usps:             strArr(raw.usps).slice(0, 5),
  };
}

// ─── Stage 2 ──────────────────────────────────────────────────────────────────

async function generateBrief(
  apiKey: string, inspection: ProductInspection,
  brandName: string, brandTone: string[], brandHex: string[],
  industry: Industry, locale: string, log: Logger,
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
    layoutId:         (LAYOUT_IDS as string[]).includes(String(raw.layoutId)) ? (raw.layoutId as LayoutId) : "text_left_product_right",
    fontPairingId:    (FONT_PAIRING_IDS as string[]).includes(String(raw.fontPairingId)) ? (raw.fontPairingId as FontPairingId) : "luxury_serif",
    sceneMood:        moods.includes(String(raw.sceneMood)) ? String(raw.sceneMood) : moods[0],
    sceneDescription: str(raw.sceneDescription, CREATIVE_FALLBACK.sceneDescription),
    storyAngle:       str(raw.storyAngle, CREATIVE_FALLBACK.storyAngle),
    headline:         str(raw.headline, CREATIVE_FALLBACK.headline),
    accentLine:       typeof raw.accentLine === "string" ? raw.accentLine.trim() : "",
    subheadline:      str(raw.subheadline, CREATIVE_FALLBACK.subheadline),
    cta:              str(raw.cta, CREATIVE_FALLBACK.cta),
    trustBullets:     postType === "product_highlight" ? trustBullets : [],
    placementNotes:   str(raw.placementNotes, CREATIVE_FALLBACK.placementNotes),
  };
}

// ─── Public ───────────────────────────────────────────────────────────────────

const VALID_INDUSTRIES = new Set<string>(["jewellery", "food_desserts", "lifestyle"]);

function resolveIndustry(v: string): Industry {
  const k = v.toLowerCase().trim();
  return VALID_INDUSTRIES.has(k) ? (k as Industry) : "lifestyle";
}

export async function analyzeCreative(input: {
  imageUrl:  string;
  brandName: string;
  brandTone: string[];
  brandHex:  string[];
  industry:  string;
  locale:    string;
  log:       Logger;
}): Promise<CreativeAnalysis> {
  const { imageUrl, brandName, brandTone, brandHex, locale, log } = input;
  const industry = resolveIndustry(input.industry);
  if (industry !== input.industry.toLowerCase().trim()) {
    log(`[creative] unknown industry "${input.industry}" — treating as "lifestyle"`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { log("[creative] OPENAI_API_KEY not set — using fallback"); return CREATIVE_FALLBACK; }

  log(`[creative] ── Stage 1: inspecting product (industry=${industry}, high-detail vision)…`);
  const inspection = await inspectProduct(apiKey, imageUrl, industry, log);
  if (!inspection) { log("[creative] Stage 1 failed — using fallback"); return CREATIVE_FALLBACK; }
  log(
    `[creative] Stage 1 done — ${inspection.productType} (${inspection.orientation}) | ${inspection.finish} | ` +
    `materials: ${inspection.materials.join(", ") || "none"} | usps: ${inspection.usps.join(" · ")}`,
  );

  log("[creative] ── Stage 2: art direction from inspection…");
  const brief = await generateBrief(apiKey, inspection, brandName, brandTone, brandHex, industry, locale, log);
  if (!brief) {
    log("[creative] Stage 2 failed — fallback copy with inspection facts");
    return { ...CREATIVE_FALLBACK, productType: inspection.productType, orientation: inspection.orientation };
  }
  log(
    `[creative] Stage 2 done — layout=${brief.layoutId} fonts=${brief.fontPairingId} scene="${brief.sceneDescription}" ` +
    `(fallback tag=${brief.sceneMood}) headline="${brief.headline}" accent="${brief.accentLine}" bullets=${JSON.stringify(brief.trustBullets)}`,
  );

  return {
    productType:      inspection.productType,
    orientation:      inspection.orientation,
    placementNotes:   brief.placementNotes,
    postType:         brief.postType,
    storyAngle:       brief.storyAngle,
    headline:         brief.headline,
    accentLine:       brief.accentLine,
    subheadline:      brief.subheadline,
    cta:              brief.cta,
    trustBullets:     brief.trustBullets.map((b) => b.text),
    trustIcons:       brief.trustBullets.map((b) => b.icon),
    layoutId:         brief.layoutId,
    fontPairingId:    brief.fontPairingId,
    sceneMood:        brief.sceneMood,
    sceneDescription: brief.sceneDescription,
  };
}
