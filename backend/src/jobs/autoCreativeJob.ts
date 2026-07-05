import cron from "node-cron";
import prisma from "../utils/prisma";
import { generateAutoCreative, getUpcomingOccasions } from "../services/autoCreative.service";

// Runs daily at 9:00am IST = 03:30 UTC
export function startAutoCreativeJob() {
  cron.schedule("30 3 * * *", async () => {
    console.log("[autoCreativeJob] Daily check starting…");

    const occasions = getUpcomingOccasions(7);
    if (!occasions.length) {
      console.log("[autoCreativeJob] No occasions within 7 days, skipping");
      return;
    }

    const occasion = occasions[0];

    // Find brands that have product images
    const brands = await prisma.brand.findMany({
      where: {
        productImages: { some: {} },
      },
      select: { id: true, userId: true },
    }).catch(() => []);

    for (const brand of brands) {
      // Check if an occasion post for this event already exists
      const existing = await prisma.generatedPost.findFirst({
        where: {
          brandId: brand.id,
          occasionName: occasion.name,
        },
      }).catch(() => null);

      if (existing) {
        console.log(`[autoCreativeJob] Occasion post for ${occasion.name} already exists for brand ${brand.id}, skipping`);
        continue;
      }

      console.log(`[autoCreativeJob] Generating ${occasion.name} post for brand ${brand.id}`);
      await generateAutoCreative(brand.id, brand.userId, "scheduled").catch((err) => {
        console.error(`[autoCreativeJob] Failed for brand ${brand.id}:`, err);
      });

      // Small delay between brands to avoid hammering APIs
      await new Promise((r) => setTimeout(r, 5000));
    }

    console.log("[autoCreativeJob] Daily check complete");
  });
}
