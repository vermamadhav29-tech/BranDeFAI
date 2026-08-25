/**
 * industryTemplates.ts
 *
 * Pure data registry of AI prompt templates, one IndustryConfig per supported
 * industry. No API calls, no DB access, no side effects.
 *
 * To add a new industry: append a new IndustryConfig object to INDUSTRY_CONFIGS
 * below and re-export — no other code needs to change.
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PromptTemplateVariant {
  id: string;
  compositionStyle: string; // e.g. "macro studio shot", "flat-lay"
  lightingPreset: string;
  backdropOptions: string[];
  promptSkeleton: string; // full template string with {SLOT} placeholders
}

export interface IndustryConfig {
  industryKey: string; // "jewellery" | "food_desserts" | "lifestyle"
  displayName: string;
  materialVocab: string[];
  defaultNegativePrompt: string;
  templates: PromptTemplateVariant[]; // 3+ variants per industry
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const INDUSTRY_CONFIGS: IndustryConfig[] = [
  // ── Jewellery ──────────────────────────────────────────────────────────────
  {
    industryKey: "jewellery",
    displayName: "Jewellery",
    materialVocab: [
      "18k yellow gold",
      "18k white gold",
      "sterling silver",
      "rose gold",
      "platinum",
      "rhodium-plated",
      "oxidised silver",
      "diamond",
      "ruby",
      "emerald",
      "sapphire",
      "pearl",
      "cubic zirconia",
      "high polish",
      "brushed matte",
      "hammered",
      "pavé-set",
    ],
    defaultNegativePrompt:
      "text, watermarks, logos, distorted metalwork, extra gemstones, cropped hands, deformed fingers, extra jewellery pieces, CGI, 3D render, cartoon, illustration, blurry, overexposed",
    templates: [
      {
        id: "studio_macro",
        compositionStyle: "macro studio shot",
        lightingPreset: "soft diffused key light upper-left, subtle rim light",
        backdropOptions: [
          "white seamless",
          "ivory linen",
          "pale grey marble",
          "black velvet",
        ],
        promptSkeleton:
          "Professional product photograph of {PRODUCT} for {BRAND_NAME}, a {BRAND_TONE} jewellery brand. Material: {MATERIAL}, finish {FINISH}. Studio macro photography, soft diffused key light from upper left, subtle rim light to define edges, {BACKDROP} backdrop. Shallow depth of field, tack-sharp focus on {FOCAL_POINT}. Color palette: {BRAND_HEX}. No text, no logos, no watermarks, no distorted metalwork, no extra gemstones, photorealistic, 4K product photography, editorial jewellery catalogue style.",
      },
      {
        id: "flatlay",
        compositionStyle: "top-down flat-lay",
        lightingPreset: "soft even studio light, minimal shadow",
        backdropOptions: [
          "white marble slab",
          "brushed concrete",
          "dark slate",
          "raw linen",
        ],
        promptSkeleton:
          "Professional flat-lay product photograph of {PRODUCT} for {BRAND_NAME}, a {BRAND_TONE} jewellery brand. Shot directly from above (90-degree top-down), arranged on {SURFACE}, soft even studio light with minimal shadow. Material: {MATERIAL}, finish {FINISH}. Color palette: {BRAND_HEX} echoed in surface styling. No text, no logos, no watermarks, no distorted metalwork, photorealistic, 4K editorial flat-lay photography.",
      },
      {
        id: "worn_lifestyle",
        compositionStyle: "worn lifestyle shot",
        lightingPreset: "soft golden-hour or diffused window light",
        backdropOptions: [
          "blurred interior",
          "softly bokeh'd garden",
          "neutral loft",
          "beige wall",
        ],
        promptSkeleton:
          "Professional lifestyle photograph of {PRODUCT} being worn, for {BRAND_NAME}, a {BRAND_TONE} jewellery brand. Close crop on {BODY_PART}, natural skin tone, soft golden-hour or diffused window light, shallow depth of field with softly blurred {SETTING} background. Material: {MATERIAL}, finish {FINISH}. Color palette: {BRAND_HEX}. No visible face unless specified, no distorted hands/fingers, no extra jewellery pieces, photorealistic, editorial jewellery campaign style.",
      },
    ],
  },

  // ── Food & Desserts ────────────────────────────────────────────────────────
  {
    industryKey: "food_desserts",
    displayName: "Food & Desserts",
    materialVocab: [
      "chocolate ganache",
      "fruit compote",
      "chantilly cream",
      "caramel drizzle",
      "gold leaf",
      "edible flowers",
      "dusted icing sugar",
      "berry coulis",
      "rustic ceramic plate",
      "slate board",
      "white porcelain",
      "wooden chopping board",
      "matte stoneware",
      "hammered copper tray",
    ],
    defaultNegativePrompt:
      "text, watermarks, logos, mouldy or unappetising food, discoloured textures, hands, plastic packaging, artificial fluorescent lighting, CGI, 3D render, cartoon, illustration, blurry, overexposed",
    templates: [
      {
        id: "studio_hero",
        compositionStyle: "studio hero shot",
        lightingPreset:
          "dramatic directional key light upper-left, soft fill, specular highlights on glaze",
        backdropOptions: [
          "white seamless",
          "pale linen",
          "matte stone grey",
          "warm cream plaster",
        ],
        promptSkeleton:
          "Professional hero product photograph of {PRODUCT} for {BRAND_NAME}, a {BRAND_TONE} food brand. Plated on {SURFACE}, dramatic directional studio key light from upper left with soft fill to reveal texture, specular highlights on glaze and cream. Three-quarter angle close-up, shallow depth of field, tack-sharp focus on {FOCAL_POINT}. Garnish: {GARNISH}. Color palette: {BRAND_HEX}. No text, no watermarks, no logos, no hands, photorealistic, 4K commercial food photography, editorial patisserie catalogue style.",
      },
      {
        id: "flatlay",
        compositionStyle: "top-down flat-lay",
        lightingPreset: "soft even diffused studio light, minimal hard shadows",
        backdropOptions: [
          "white marble",
          "dark slate",
          "weathered timber",
          "terracotta linen",
        ],
        promptSkeleton:
          "Professional flat-lay food photograph of {PRODUCT} for {BRAND_NAME}, a {BRAND_TONE} food brand. Shot directly from above (90-degree top-down), arranged on {SURFACE} with complementary ingredients and props, soft even diffused studio light with minimal hard shadows. Garnish: {GARNISH}. Color palette: {BRAND_HEX} echoed in surface and prop styling. No text, no watermarks, no logos, photorealistic, 4K editorial flat-lay food photography, styled by professional food stylist.",
      },
      {
        id: "lifestyle_table",
        compositionStyle: "lifestyle table scene",
        lightingPreset:
          "warm natural window light, soft morning or golden-hour glow",
        backdropOptions: [
          "café corner",
          "home kitchen counter",
          "rustic wooden dining table",
          "marble brunch spread",
        ],
        promptSkeleton:
          "Professional lifestyle food photograph of {PRODUCT} for {BRAND_NAME}, a {BRAND_TONE} food brand. Scene set on {SURFACE} in a {SETTING}, warm natural window light from one side, complementary tableware and {PROPS}, softly blurred background. Garnish: {GARNISH}. Color palette: {BRAND_HEX}. No faces, no text, no watermarks, no logos, photorealistic, 4K editorial lifestyle food photography, aspirational café or home-entertaining aesthetic.",
      },
    ],
  },

  // ── Lifestyle ──────────────────────────────────────────────────────────────
  {
    industryKey: "lifestyle",
    displayName: "Lifestyle",
    materialVocab: [
      "brushed aluminium",
      "matte polypropylene",
      "leather-grain finish",
      "frosted glass",
      "recycled cotton canvas",
      "natural bamboo",
      "powder-coated steel",
      "vegan leather",
      "woven textile",
      "cork",
      "soft-touch rubber",
      "anodised metal",
    ],
    defaultNegativePrompt:
      "text, watermarks, logos, cluttered backgrounds, faces unless specified, distorted limbs, extra product copies, price tags, CGI artifacts, 3D render, cartoon, illustration, blurry, overexposed",
    templates: [
      {
        id: "studio_clean",
        compositionStyle: "clean studio shot",
        lightingPreset:
          "three-point studio lighting — bright key, soft fill, clean rim",
        backdropOptions: [
          "pure white seamless",
          "light grey gradient",
          "warm off-white",
          "soft nude",
        ],
        promptSkeleton:
          "Professional studio product photograph of {PRODUCT} for {BRAND_NAME}, a {BRAND_TONE} lifestyle brand. Positioned on {SURFACE}, three-point studio lighting — bright key light, soft fill, clean rim light to separate from {BACKDROP} backdrop. Material: {MATERIAL}, finish {FINISH}. Tack-sharp full-product focus. Color palette: {BRAND_HEX}. No text, no watermarks, no logos, no extra objects, photorealistic, 4K commercial product photography, Scandinavian minimalist editorial style.",
      },
      {
        id: "flatlay",
        compositionStyle: "top-down flat-lay",
        lightingPreset: "soft even diffused studio light, minimal hard shadows",
        backdropOptions: [
          "white linen",
          "pale concrete",
          "natural oak surface",
          "terracotta plaster",
        ],
        promptSkeleton:
          "Professional flat-lay product photograph of {PRODUCT} for {BRAND_NAME}, a {BRAND_TONE} lifestyle brand. Shot directly from above (90-degree top-down), arranged on {SURFACE} alongside complementary {PROPS} that reflect the brand world, soft even diffused studio light with minimal hard shadows. Material: {MATERIAL}, finish {FINISH}. Color palette: {BRAND_HEX} echoed in prop and surface selection. No text, no watermarks, no logos, photorealistic, 4K editorial flat-lay, clean lifestyle-brand aesthetic.",
      },
      {
        id: "in_context_use",
        compositionStyle: "in-context lifestyle use",
        lightingPreset: "natural ambient light, warm or cool to match setting",
        backdropOptions: [
          "urban street",
          "minimalist apartment",
          "outdoor café terrace",
          "coworking space",
        ],
        promptSkeleton:
          "Professional lifestyle photograph of {PRODUCT} in use, for {BRAND_NAME}, a {BRAND_TONE} lifestyle brand. Photographed in a {SETTING}, natural ambient light, shallow depth of field with softly blurred background, product as the clear hero. Material: {MATERIAL}, finish {FINISH}. Color palette: {BRAND_HEX} complemented by environment tones. No visible faces unless specified, no cluttered backgrounds, no distorted objects, photorealistic, 4K editorial lifestyle photography, aspirational {BRAND_TONE} campaign aesthetic.",
      },
    ],
  },
];

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Returns the IndustryConfig for the given key (case-insensitive).
 * Returns null — never throws — if the key is not found, so calling
 * code can fall back gracefully without a try/catch.
 */
export function getIndustryConfig(industryKey: string): IndustryConfig | null {
  const key = industryKey.toLowerCase().trim();
  return INDUSTRY_CONFIGS.find((c) => c.industryKey === key) ?? null;
}
