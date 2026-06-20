import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing test data
  await prisma.brand.deleteMany({ where: { brandName: "TestBrand" } });
  await prisma.user.deleteMany({ where: { email: "test@brandefai.com" } });

  const passwordHash = await bcrypt.hash("testpass123", 12);

  const user = await prisma.user.create({
    data: {
      email: "test@brandefai.com",
      passwordHash,
      plan: "PRO",
      creditsBalance: 200,
    },
  });

  const brand = await prisma.brand.create({
    data: {
      userId: user.id,
      brandName: "TestBrand",
      industry: "Fashion",
      targetAudience: "Young adults 18-30 interested in streetwear",
      tone: "Bold",
      strategyApproved: false,
    },
  });

  console.log("✅ Seeded:");
  console.log(`   User  → ${user.email} (id: ${user.id})`);
  console.log(`   Brand → ${brand.brandName} (id: ${brand.id})`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
