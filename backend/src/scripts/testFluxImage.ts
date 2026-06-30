import "dotenv/config";
import prisma from "../utils/prisma";
import { buildFluxPrompt, generateLifestyleImage } from "../services/fluxImage.service";

// Disposable fixture only — never touches existing brands/users.
async function main() {
  const user = await prisma.user.create({
    data: { email: `__test_flux_image_${Date.now()}@example.invalid`, creditsBalance: 50 },
  });

  const brand = await prisma.brand.create({
    data: {
      userId: user.id,
      brandName: "__TEST_BRAND__",
      industry: "Gelato & desserts",
      targetAudience: "Urban professionals aged 25-35 who treat themselves to small indulgences",
      tone: "Playful",
      whatTheySell: "handmade gelato and cookies",
      city: "Delhi",
    },
  });

  console.log(`Created disposable test brand ${brand.id} / user ${user.id}`);

  const brief = "handmade mango gelato in a glass cup, Delhi cafe setting";

  const { prompt, negativePrompt } = buildFluxPrompt(
    brief,
    `${brand.brandName}, a ${brand.industry} brand, based in ${brand.city}`,
    false
  );
  console.log("\n=== BUILT PROMPT ===");
  console.log(prompt);
  console.log("\n=== NEGATIVE PROMPT ===");
  console.log(negativePrompt);

  console.log("\n=== CALLING FLUX 2 PRO (this can take up to ~2 min) ===");
  const result = await generateLifestyleImage(user.id, brand.id, brief);

  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  const record = await prisma.generatedImage.findUnique({ where: { id: result.imageId } });
  console.log("\n=== SAVED GeneratedImage ROW ===");
  console.log(JSON.stringify(record, null, 2));

  const finalUser = await prisma.user.findUnique({ where: { id: user.id }, select: { creditsBalance: true } });
  console.log(`\n=== CREDITS AFTER (started at 50, expect 45): ${finalUser?.creditsBalance} ===`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
