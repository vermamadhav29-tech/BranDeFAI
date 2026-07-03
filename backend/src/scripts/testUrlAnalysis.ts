/**
 * Disposable-fixture test for GPT-4o URL brand analysis.
 * Per feedback_test_isolation.md — creates its own user/brand, never touches existing data.
 *
 * Run: npx ts-node src/scripts/testUrlAnalysis.ts
 */
import "dotenv/config";
import prisma from "../utils/prisma";
import { analyseUrlForBrandContext, generateBrandDNA } from "../services/brandDNA.service";

const URLS = [
  "https://www.instagram.com/ameeco_gelato",
  "https://brandefai.com",
];

async function main() {
  // ── analyseUrlForBrandContext for each URL ────────────────────────────────
  for (const url of URLS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`URL: ${url}`);
    const t = Date.now();
    const result = await analyseUrlForBrandContext(url);
    console.log(`Elapsed: ${Date.now() - t}ms`);
    if (result) {
      console.log(result);
    } else {
      console.log("(empty — both web browsing and URL-only fallback returned nothing)");
    }
  }

  // ── Full Brand DNA generation with URL enrichment ─────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log("=== generateBrandDNA with URL enrichment (ameeco_gelato) ===");

  const user = await prisma.user.create({
    data: { email: `__test_url_analysis_${Date.now()}@example.invalid`, creditsBalance: 0 },
  });
  const brand = await prisma.brand.create({
    data: {
      userId: user.id,
      brandName: "Ameeco Gelato",
      industry: "Food & Beverage",
      targetAudience: "Urban Indians who love premium desserts",
      tone: "Playful",
      instagramUrl: URLS[0],
    },
  });
  console.log(`Disposable fixture: user=${user.id}  brand=${brand.id}`);

  const t2 = Date.now();
  const dna = await generateBrandDNA({
    brandName: brand.brandName,
    industry: brand.industry,
    brandVibe: brand.tone,
    url: URLS[0],
  });
  console.log(`Elapsed: ${Date.now() - t2}ms`);
  console.log(JSON.stringify(dna, null, 2));

  // Save to brand record
  await prisma.brand.update({
    where: { id: brand.id },
    data: { brandDna: JSON.stringify(dna) },
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  console.log("\n=== VALIDATION ===");
  const dnaStr = JSON.stringify(dna).toLowerCase();
  const checks = [
    { label: "brand_personality present",  pass: Array.isArray(dna.brand_personality) && dna.brand_personality.length > 0 },
    { label: "sample_caption present",     pass: typeof dna.sample_caption === "string" && dna.sample_caption.length > 10 },
    { label: "content_pillars (4)",        pass: Array.isArray(dna.content_pillars) && dna.content_pillars.length === 4 },
    { label: "food/gelato-specific",       pass: dnaStr.includes("gelato") || dnaStr.includes("dessert") || dnaStr.includes("ice cream") || dnaStr.includes("food") },
    { label: "sample_caption not generic", pass: dna.sample_caption.length > 30 && !dna.sample_caption.toLowerCase().includes("your brand") },
  ];

  let allPass = true;
  for (const c of checks) {
    console.log(`${c.pass ? "✅" : "❌"}  ${c.label}`);
    if (!c.pass) allPass = false;
  }
  console.log(`\nOverall: ${allPass ? "✅ PASS" : "❌ FAIL"}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
