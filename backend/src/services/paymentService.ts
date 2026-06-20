import Razorpay from "razorpay";
import type { Orders } from "razorpay/dist/types/orders";
import crypto from "crypto";
import prisma from "../utils/prisma";
import { Plan } from "@prisma/client";
import { createError } from "../middleware/errorHandler";

const PLAN_PRICES: Record<"PRO" | "BUSINESS", number> = {
  PRO: 99900,       // ₹999
  BUSINESS: 249900, // ₹2499
};

const PLAN_CREDITS: Record<Plan, number> = {
  FREE: 50,
  PRO: 500,
  BUSINESS: 2000,
};

// Credit packs — amount in paise → credits added (no plan change)
const CREDIT_PACKS: Record<number, number> = {
  179900: 100, // ₹1799 → 100 credits
  349900: 250, // ₹3499 → 250 credits
};

function getRazorpay(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    console.error("[Razorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing from env");
    throw createError("Payment service is not configured. Contact support.", 503);
  }

  return new Razorpay({ key_id, key_secret });
}

async function createRazorpayOrder(amount: number, receipt: string): Promise<Orders.RazorpayOrder> {
  const razorpay = getRazorpay();
  try {
    const order = await razorpay.orders.create({ amount, currency: "INR", receipt });
    return order;
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: { description?: string }; message?: string };
    console.error("[Razorpay] Order creation failed:", JSON.stringify(e, null, 2));
    throw createError(
      e?.error?.description ?? e?.message ?? "Failed to create payment order",
      e?.statusCode ?? 502
    );
  }
}

// ─── createOrder (plan upgrade) ───────────────────────────────────────────────

export async function createOrder(userId: string, plan: "PRO" | "BUSINESS") {
  const amount = PLAN_PRICES[plan];
  const receipt = `rcp_${userId.replace(/-/g, "").slice(0, 20)}_${Date.now().toString().slice(-8)}`;

  console.log(`[Razorpay] Creating plan order — plan=${plan} amount=${amount} receipt=${receipt}`);

  const order = await createRazorpayOrder(amount, receipt);

  await prisma.paymentOrder.create({
    data: { userId, razorpayOrderId: order.id, plan: plan as Plan, amount },
  });

  console.log(`[Razorpay] Plan order created — orderId=${order.id}`);

  return {
    orderId: order.id,
    amount,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID!,
  };
}

// ─── createCreditPackOrder ─────────────────────────────────────────────────────

export async function createCreditPackOrder(userId: string, amount: number) {
  if (!CREDIT_PACKS[amount]) {
    throw createError(`Invalid credit pack amount: ${amount}. Valid amounts: ${Object.keys(CREDIT_PACKS).join(", ")}`, 400);
  }

  const receipt = `cpk_${userId.replace(/-/g, "").slice(0, 18)}_${Date.now().toString().slice(-8)}`;

  console.log(`[Razorpay] Creating credit pack order — amount=${amount} credits=${CREDIT_PACKS[amount]} receipt=${receipt}`);

  const order = await createRazorpayOrder(amount, receipt);

  // Store with the user's current plan (credit packs don't change the plan)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });

  await prisma.paymentOrder.create({
    data: { userId, razorpayOrderId: order.id, plan: user?.plan ?? Plan.FREE, amount },
  });

  console.log(`[Razorpay] Credit pack order created — orderId=${order.id}`);

  return {
    orderId: order.id,
    amount,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID!,
    creditsToAdd: CREDIT_PACKS[amount],
  };
}

// ─── verifyPayment ─────────────────────────────────────────────────────────────

export async function verifyPayment(
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  userId: string
) {
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_secret) {
    console.error("[verifyPayment] RAZORPAY_KEY_SECRET missing");
    throw createError("Payment service not configured", 503);
  }

  // Razorpay signature format: HMAC-SHA256("order_id|payment_id", key_secret)
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto.createHmac("sha256", key_secret).update(body).digest("hex");

  console.log(`[verifyPayment] order=${razorpay_order_id} payment=${razorpay_payment_id}`);
  console.log(`[verifyPayment] expected_sig=${expectedSignature} received_sig=${razorpay_signature}`);

  if (expectedSignature !== razorpay_signature) {
    console.error("[verifyPayment] Signature mismatch — rejecting");
    throw createError("Payment verification failed: signature mismatch", 400);
  }

  console.log("[verifyPayment] Signature verified OK");

  const order = await prisma.paymentOrder.findUnique({ where: { razorpayOrderId: razorpay_order_id } });
  if (!order) throw createError("Order not found", 404);
  if (order.userId !== userId) throw createError("Order does not belong to this user", 403);

  if (order.status === "PAID") {
    console.log("[verifyPayment] Already processed (idempotent)");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { creditsBalance: true, plan: true } });
    return { alreadyProcessed: true, newBalance: user?.creditsBalance ?? 0, plan: order.plan };
  }

  const isCreditPack = CREDIT_PACKS[order.amount] !== undefined;
  console.log(`[verifyPayment] type=${isCreditPack ? "credit_pack" : "plan_upgrade"} amount=${order.amount}`);

  if (isCreditPack) {
    // Add credits to current balance without changing plan
    const creditsToAdd = CREDIT_PACKS[order.amount];
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { creditsBalance: true } });
    const newBalance = (currentUser?.creditsBalance ?? 0) + creditsToAdd;

    await prisma.$transaction([
      prisma.paymentOrder.update({ where: { id: order.id }, data: { status: "PAID" } }),
      prisma.user.update({ where: { id: userId }, data: { creditsBalance: newBalance } }),
      prisma.creditTransaction.create({
        data: { userId, amount: creditsToAdd, type: "PURCHASE", referenceId: razorpay_payment_id, balanceAfter: newBalance },
      }),
    ]);

    console.log(`[verifyPayment] Added ${creditsToAdd} credits. New balance: ${newBalance}`);
    return { alreadyProcessed: false, newBalance, creditsAdded: creditsToAdd, plan: order.plan };
  } else {
    // Plan upgrade — reset credits to the plan allocation
    const creditsToSet = PLAN_CREDITS[order.plan];

    await prisma.$transaction([
      prisma.paymentOrder.update({ where: { id: order.id }, data: { status: "PAID" } }),
      prisma.user.update({ where: { id: userId }, data: { plan: order.plan, creditsBalance: creditsToSet } }),
      prisma.creditTransaction.create({
        data: { userId, amount: creditsToSet, type: "PURCHASE", referenceId: razorpay_payment_id, balanceAfter: creditsToSet },
      }),
    ]);

    console.log(`[verifyPayment] Plan upgraded to ${order.plan} with ${creditsToSet} credits`);
    return { alreadyProcessed: false, newBalance: creditsToSet, creditsAdded: creditsToSet, plan: order.plan };
  }
}

// ─── handleWebhook ─────────────────────────────────────────────────────────────

export async function handleWebhook(rawBody: Buffer, signature: string): Promise<{ valid: boolean }> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] RAZORPAY_WEBHOOK_SECRET missing");
    return { valid: false };
  }

  const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  if (expectedSig !== signature) {
    console.warn("[webhook] Signature mismatch — ignoring");
    return { valid: false };
  }

  const payload = JSON.parse(rawBody.toString()) as {
    event: string;
    payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
  };

  console.log(`[webhook] event=${payload.event}`);

  if (payload.event !== "payment.captured") return { valid: true };

  const razorpayOrderId = payload.payload?.payment?.entity?.order_id;
  const razorpayPaymentId = payload.payload?.payment?.entity?.id;
  if (!razorpayOrderId) return { valid: true };

  const order = await prisma.paymentOrder.findUnique({ where: { razorpayOrderId } });
  if (!order || order.status === "PAID") {
    console.log(`[webhook] Order ${razorpayOrderId} already processed or not found — skipping`);
    return { valid: true };
  }

  const isCreditPack = CREDIT_PACKS[order.amount] !== undefined;

  if (isCreditPack) {
    const creditsToAdd = CREDIT_PACKS[order.amount];
    const currentUser = await prisma.user.findUnique({ where: { id: order.userId }, select: { creditsBalance: true } });
    const newBalance = (currentUser?.creditsBalance ?? 0) + creditsToAdd;

    await prisma.$transaction([
      prisma.paymentOrder.update({ where: { id: order.id }, data: { status: "PAID" } }),
      prisma.user.update({ where: { id: order.userId }, data: { creditsBalance: newBalance } }),
      prisma.creditTransaction.create({
        data: { userId: order.userId, amount: creditsToAdd, type: "PURCHASE", referenceId: razorpayPaymentId, balanceAfter: newBalance },
      }),
    ]);

    console.log(`[webhook] Credit pack: added ${creditsToAdd} credits to user ${order.userId}. New balance: ${newBalance}`);
  } else {
    const credits = PLAN_CREDITS[order.plan];

    await prisma.$transaction([
      prisma.paymentOrder.update({ where: { id: order.id }, data: { status: "PAID" } }),
      prisma.user.update({ where: { id: order.userId }, data: { plan: order.plan, creditsBalance: credits } }),
      prisma.creditTransaction.create({
        data: { userId: order.userId, amount: credits, type: "PLAN_ALLOCATION", referenceId: order.id, balanceAfter: credits },
      }),
    ]);

    console.log(`[webhook] Plan upgrade: user ${order.userId} → ${order.plan} with ${credits} credits`);
  }

  return { valid: true };
}

// ─── checkOrderStatus ──────────────────────────────────────────────────────────

export async function checkOrderStatus(razorpayOrderId: string) {
  const order = await prisma.paymentOrder.findUnique({
    where: { razorpayOrderId },
    select: { status: true, plan: true },
  });
  if (!order) throw createError("Order not found", 404);
  return { status: order.status, plan: order.plan };
}
