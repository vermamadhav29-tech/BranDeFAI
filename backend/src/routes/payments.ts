import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { sendSuccess } from "../utils/response";
import {
  createOrder,
  createCreditPackOrder,
  verifyPayment,
  handleWebhook,
  checkOrderStatus,
} from "../services/paymentService";

const router = Router();

const createOrderSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

const createPackOrderSchema = z.object({
  amount: z.number().int().positive(),
});

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// ─── POST /api/payments/create-order (plan upgrade) ───────────────────────────

router.post(
  "/create-order",
  authMiddleware,
  validate(createOrderSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { plan } = req.body as { plan: "PRO" | "BUSINESS" };
      console.log(`[payments] create-order — userId=${req.user!.id} plan=${plan}`);
      const result = await createOrder(req.user!.id, plan);
      console.log(`[payments] order created — orderId=${result.orderId}`);
      sendSuccess(res, result, 201);
    } catch (err) {
      console.error("[payments] create-order error:", err);
      next(err);
    }
  }
);

// ─── POST /api/payments/create-pack-order (credit top-up) ─────────────────────

router.post(
  "/create-pack-order",
  authMiddleware,
  validate(createPackOrderSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { amount } = req.body as { amount: number };
      console.log(`[payments] create-pack-order — userId=${req.user!.id} amount=${amount}`);
      const result = await createCreditPackOrder(req.user!.id, amount);
      console.log(`[payments] pack order created — orderId=${result.orderId} credits=${result.creditsToAdd}`);
      sendSuccess(res, result, 201);
    } catch (err) {
      console.error("[payments] create-pack-order error:", err);
      next(err);
    }
  }
);

// ─── POST /api/payments/verify ─────────────────────────────────────────────────

router.post(
  "/verify",
  authMiddleware,
  validate(verifySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        req.body as { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

      console.log(`[payments] verify — userId=${req.user!.id} order=${razorpay_order_id} payment=${razorpay_payment_id}`);

      const result = await verifyPayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        req.user!.id
      );

      console.log(`[payments] verify success — newBalance=${result.newBalance} plan=${result.plan}`);
      sendSuccess(res, result);
    } catch (err) {
      console.error("[payments] verify error:", err);
      next(err);
    }
  }
);

// ─── POST /api/payments/webhook ────────────────────────────────────────────────
// Raw body mounted at app level in index.ts before express.json().
// Always returns 200 — Razorpay retries on any non-2xx.

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const sigHeader = req.headers["x-razorpay-signature"];
    const signature = typeof sigHeader === "string" ? sigHeader : "";
    await handleWebhook(req.body as Buffer, signature);
  } catch (err) {
    console.error("[payments] webhook error:", err);
  }
  res.status(200).json({ received: true });
});

// ─── GET /api/payments/status/:orderId ────────────────────────────────────────

router.get(
  "/status/:orderId",
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await checkOrderStatus(req.params.orderId as string);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
