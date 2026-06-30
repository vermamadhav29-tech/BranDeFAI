import "dotenv/config";
import prisma from "../utils/prisma";
import { generateBrandDNA } from "../services/brandDNA.service";
import { regenerateCaptions } from "../services/contentService";

// Disposable fixture only — never touches existing brands/users.
async function main() {
  const user = await prisma.user.create({
    data: { email: `__test_quality_gate_${Date.now()}@example.invalid`, creditsBalance: 50 },
  });

  const brand = await prisma.brand.create({
    data: {
      userId: user.id,
      brandName: "__TEST_BRAND__",
      industry: "Gelato & desserts",
      targetAudience: "Urban professionals aged 25-35 who treat themselves to small indulgences",
      tone: "Playful",
      whatTheySell: "handmade gelato and cookies",
      city: "Mumbai",
    },
  });

  console.log(`Created disposable test brand ${brand.id} / user ${user.id}`);

  const dna = await generateBrandDNA({
    brandName: brand.brandName,
    whatTheySell: brand.whatTheySell,
    brandBrief: brand.brandBrief,
    industry: brand.industry,
    brandVibe: brand.tone,
  });
  await prisma.brand.update({ where: { id: brand.id }, data: { brandDna: JSON.stringify(dna) } });
  console.log("Brand DNA generated.");

  const content = await prisma.generatedContent.create({
    data: { userId: user.id, brandId: brand.id, captions: [], adCopy: {}, reelIdeas: [] },
  });
  console.log(`Created test GeneratedContent row ${content.id}`);

  const result = await regenerateCaptions(
    content.id,
    user.id,
    "New monsoon-special mango gelato flavor just launched",
    "promotional"
  );

  console.log("\n=== RESPONSE RETURNED TO CLIENT (must contain NO quality scores) ===");
  console.log(JSON.stringify(result, null, 2));

  const logs = await prisma.contentQualityLog.findMany({ where: { contentId: content.id } });
  console.log(`\n=== INTERNAL content_quality_logs ROWS (${logs.length}) ===`);
  console.log(JSON.stringify(logs, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
