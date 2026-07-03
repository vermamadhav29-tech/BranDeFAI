import "dotenv/config";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import prisma from "../utils/prisma";
import { generatePromoCreative, extractBrandColorFromLogo } from "../services/promoCreative.service";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Realistic rectangular logo: green pill background + white "BF" wordmark — transparent
// surrounding so it sits naturally on any background. Mimics a real brand logo PNG.
async function uploadTestLogo(): Promise<string> {
  const svg = `
    <svg width="400" height="160" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="380" height="140" rx="24" ry="24" fill="#1A7A4A"/>
      <text x="200" y="100" text-anchor="middle" font-family="Arial" font-size="80"
        font-weight="bold" fill="#FFFFFF">BF</text>
      <circle cx="340" cy="50" r="22" fill="#FFFFFF" opacity="0.25"/>
    </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "brandefai/logos", resource_type: "image" }, (err, result) => {
      if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
      resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}

// Disposable fixture only — never touches existing brands/users.
async function main() {
  console.log("=== Uploading synthetic test logo ===");
  const logoUrl = await uploadTestLogo();
  console.log(`Logo URL: ${logoUrl}`);

  const user = await prisma.user.create({
    data: { email: `__test_promo_creative_${Date.now()}@example.invalid`, creditsBalance: 50 },
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
      logoUrl,
    },
  });

  console.log(`Created disposable test brand ${brand.id} / user ${user.id}`);

  console.log("\n=== Calling extractBrandColorFromLogo ===");
  const colors = await extractBrandColorFromLogo(user.id);
  console.log(JSON.stringify(colors, null, 2));

  const brief = "handmade mango gelato in a glass cup, Delhi cafe setting";

  console.log("\n=== Calling generatePromoCreative (this can take up to ~2 min) ===");
  const result = await generatePromoCreative(user.id, brand.id, brief, "Order Now", "Diwali");

  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  const record = await prisma.generatedImage.findUnique({ where: { id: result.imageId } });
  console.log("\n=== SAVED GeneratedImage ROW ===");
  console.log(JSON.stringify(record, null, 2));

  const finalUser = await prisma.user.findUnique({ where: { id: user.id }, select: { creditsBalance: true } });
  console.log(`\n=== CREDITS AFTER (started at 50, expect 45): ${finalUser?.creditsBalance} ===`);

  const finalBrand = await prisma.brand.findUnique({
    where: { id: brand.id },
    select: { logoColorPrimary: true, logoColorSecondary: true },
  });
  console.log(`\n=== BRAND COLORS CACHED: ${JSON.stringify(finalBrand)} ===`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
