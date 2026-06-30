import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { sendSuccess } from "../utils/response";
import prisma from "../utils/prisma";

const router = Router();

router.get("/trends", authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // Build array of the last 7 days (oldest first)
    const days: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const sevenDaysAgo = days[0];

    // Month start for "this month" aggregates
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Fetch all records in range in 4 queries
    const [contentItems, imageItems, calendarItems, creditTxs, userData] =
      await Promise.all([
        prisma.generatedContent.findMany({
          where: { userId, createdAt: { gte: sevenDaysAgo } },
          select: { createdAt: true },
        }),
        prisma.generatedImage.findMany({
          where: { userId, createdAt: { gte: sevenDaysAgo } },
          select: { createdAt: true },
        }),
        prisma.calendarEntry.findMany({
          where: { userId, createdAt: { gte: sevenDaysAgo } },
          select: { createdAt: true },
        }),
        prisma.creditTransaction.findMany({
          where: { userId },
          select: { createdAt: true, balanceAfter: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { creditsBalance: true },
        }),
      ]);

    const currentBalance = userData?.creditsBalance ?? 0;

    // Group by day helper
    function countByDay(items: { createdAt: Date }[]) {
      return days.map((day) => {
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);
        const count = items.filter(
          (i) => i.createdAt >= day && i.createdAt < nextDay
        ).length;
        return {
          day: day.toLocaleDateString("en-US", { weekday: "short" }),
          value: count,
        };
      });
    }

    // Credit balance snapshot per day: last transaction before end-of-day
    const creditTrend = days.map((day) => {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const txsUpToDay = creditTxs.filter((t) => t.createdAt < nextDay);
      const lastTx = txsUpToDay[txsUpToDay.length - 1];
      return {
        day: day.toLocaleDateString("en-US", { weekday: "short" }),
        value: lastTx?.balanceAfter ?? currentBalance,
      };
    });

    // Images this month (all-time month query separately)
    const imagesThisMonth = await prisma.generatedImage.count({
      where: { userId, createdAt: { gte: monthStart } },
    });

    const weeklyContent = contentItems.length;
    const weeklyImages = imageItems.length;

    sendSuccess(res, {
      credits: creditTrend,
      content: countByDay(contentItems),
      calendar: countByDay(calendarItems),
      images: countByDay(imageItems),
      weeklyContent,
      weeklyImages,
      imagesThisMonth,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
