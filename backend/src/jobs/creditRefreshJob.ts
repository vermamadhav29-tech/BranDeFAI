import cron from "node-cron";
import prisma from "../utils/prisma";
import { Plan } from "@prisma/client";

const PLAN_CREDITS: Record<Plan, number> = {
  FREE: 50,
  PRO: 500,
  BUSINESS: 2000,
};

// Runs at midnight on the 1st of every month
export function startCreditRefreshJob() {
  cron.schedule("0 0 1 * *", async () => {
    console.log("[creditRefreshJob] Starting monthly credit refresh…");
    try {
      const users = await prisma.user.findMany({
        where: { plan: { in: [Plan.PRO, Plan.BUSINESS] } },
        select: { id: true, plan: true },
      });

      let updated = 0;
      for (const user of users) {
        const credits = PLAN_CREDITS[user.plan];
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { creditsBalance: credits },
          }),
          prisma.creditTransaction.create({
            data: {
              userId: user.id,
              amount: credits,
              type: "PLAN_ALLOCATION",
              balanceAfter: credits,
            },
          }),
        ]);
        updated++;
      }

      console.log(`[creditRefreshJob] Monthly credit refresh complete: ${updated} users updated`);
    } catch (err) {
      console.error("[creditRefreshJob] Error during monthly refresh:", err);
    }
  });
}
