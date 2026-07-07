/**
 * Standalone test for creativeBrief.service.ts
 *
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/test-creative-brief.ts
 *
 * Uses the Railway DATABASE_URL from .env so it runs against live data.
 * Picks any brand with brandDna to avoid creating disposable test data.
 */
import "dotenv/config";
import prisma from "../src/utils/prisma";
import { generateCreativeBrief } from "../src/services/creativeBrief.service";

const EXISTING_JEWELLERY_IMAGE =
  "https://res.cloudinary.com/dsidv1cmg/image/upload/v1783100765/brandefai/products/lzswb3kbhmesffa12bxe.jpg";

const REQUIRED_FIELDS: (keyof import("../src/services/creativeBrief.service").CreativeBrief)[] = [
  "headline",
  "headline_accent",
  "subheadline",
  "cta",
  "background_scene",
  "background_mood",
  "background_negative",
  "product_placement",
  "product_size",
  "layout_style",
  "primary_color",
  "accent_color",
  "flux_prompt",
  "flux_negative",
];

(async () => {
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  creativeBrief.service — generateCreativeBrief() test`);
  console.log(`${"─".repeat(64)}`);

  // ── Find a brand with DNA ──────────────────────────────────────────────────
  const brand = await prisma.brand.findFirst({
    where: { brandDna: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, brandName: true, industry: true },
  });

  if (!brand) {
    console.error("\n  ✗  No brand with Brand DNA found in the database.");
    console.error("     Run the auto-creative pipeline test first to seed one.\n");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`\n  Brand : ${brand.brandName} (${brand.industry})`);
  console.log(`  ID    : ${brand.id}`);
  console.log(`  Image : ${EXISTING_JEWELLERY_IMAGE}`);

  // ── Call the service ───────────────────────────────────────────────────────
  console.log(`\n  ⏳  Calling generateCreativeBrief — GPT-4o, temperature 0.8 ...`);
  const t0 = Date.now();

  const brief = await generateCreativeBrief({
    brandId: brand.id,
    productImageUrl: EXISTING_JEWELLERY_IMAGE,
    productDescription: "Gold bangles, diamond rings, and bridal jewellery sets",
    ideaTitle: "Monsoon moment post",
    ideaType: "seasonal",
    occasionName: "Monsoon",
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✓  Completed in ${elapsed}s`);

  // ── Print the full brief ───────────────────────────────────────────────────
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  CREATIVE BRIEF`);
  console.log(`${"─".repeat(64)}`);

  console.log(`\n  COPY`);
  console.log(`    headline        : "${brief.headline}"`);
  console.log(`    headline_accent : "${brief.headline_accent}"`);
  console.log(`    subheadline     : "${brief.subheadline}"`);
  if (brief.body_text) console.log(`    body_text       : "${brief.body_text}"`);
  console.log(`    cta             : "${brief.cta}"`);
  if (brief.tagline) console.log(`    tagline         : "${brief.tagline}"`);

  console.log(`\n  SCENE`);
  console.log(`    background_scene    : "${brief.background_scene}"`);
  console.log(`    background_mood     : "${brief.background_mood}"`);
  console.log(`    background_negative : "${brief.background_negative}"`);
  console.log(`    product_placement   : ${brief.product_placement}`);
  console.log(`    product_size        : ${brief.product_size}`);

  console.log(`\n  DESIGN`);
  console.log(`    layout_style    : ${brief.layout_style}`);
  console.log(`    primary_color   : ${brief.primary_color}`);
  console.log(`    accent_color    : ${brief.accent_color}`);
  if (brief.feature_badges?.length) console.log(`    feature_badges  : ${brief.feature_badges.join(" | ")}`);
  if (brief.occasion_badge) console.log(`    occasion_badge  : "${brief.occasion_badge}"`);

  console.log(`\n  GENERATION`);
  console.log(`    flux_negative   : "${brief.flux_negative}"`);
  console.log(`\n    flux_prompt:\n`);
  brief.flux_prompt.split(/\[/).filter(Boolean).forEach((seg) => {
    console.log(`      [${seg.trim()}`);
  });

  // ── Validate ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  VALIDATION`);
  console.log(`${"─".repeat(64)}\n`);

  const fluxWords = brief.flux_prompt.split(/\s+/).filter(Boolean).length;
  const headlineWords = brief.headline.split(/\s+/).filter(Boolean).length;
  const allFieldsPresent = REQUIRED_FIELDS.every(
    (f) => (brief as Record<string, unknown>)[f] !== undefined && (brief as Record<string, unknown>)[f] !== ""
  );

  console.log(`  flux_prompt word count  : ${fluxWords}  ${fluxWords >= 100 ? "✓ (≥100)" : "✗ (need ≥100)"}`);
  console.log(`  headline word count     : ${headlineWords}  ${headlineWords <= 4 ? "✓ (≤4)" : "✗ (need ≤4)"}`);
  console.log(`  all required fields     : ${allFieldsPresent ? "✓" : "✗"}`);
  console.log(`  has [SCENE] marker      : ${brief.flux_prompt.includes("[SCENE]") ? "✓" : "✗"}`);
  console.log(`  has [CAMERA] marker     : ${brief.flux_prompt.includes("[CAMERA]") ? "✓" : "✗"}`);
  console.log(`  has [STYLE] marker      : ${brief.flux_prompt.includes("[STYLE]") ? "✓" : "✗"}`);
  console.log(`  product_placement valid : ${["left","right","center","bottom-center"].includes(brief.product_placement) ? "✓" : "✗"}`);

  const passed = fluxWords >= 100 && headlineWords <= 4 && allFieldsPresent &&
    brief.flux_prompt.includes("[SCENE]") && brief.flux_prompt.includes("[CAMERA]");

  console.log(`\n  ${passed ? "✅  All checks passed" : "❌  Some checks failed"}\n`);

  await prisma.$disconnect();
  process.exit(passed ? 0 : 1);
})();
