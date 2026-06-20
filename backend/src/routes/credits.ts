import { Router, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { sendSuccess } from "../utils/response";
import prisma from "../utils/prisma";
import { Plan } from "@prisma/client";

const router = Router();

router.use(authMiddleware);

const PLAN_MAX: Record<Plan, number> = {
  FREE: 50,
  PRO: 500,
  BUSINESS: 2000,
};

// GET /api/credits/balance
router.get("/balance", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Re-fetch from DB so balance is always fresh
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { creditsBalance: true, plan: true },
    });
    const plan = user?.plan ?? req.user!.plan;
    sendSuccess(res, {
      creditsBalance: user?.creditsBalance ?? req.user!.creditsBalance,
      plan,
      planMax: PLAN_MAX[plan],
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/credits/history — last 50 transactions, newest first
router.get("/history", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    sendSuccess(res, { transactions });
  } catch (err) {
    next(err);
  }
});

export default router;
