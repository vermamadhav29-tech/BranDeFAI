"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Zap, ChevronLeft, ChevronRight, ArrowUpRight, Sparkles, Package } from "lucide-react";
import apiClient from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditTransaction {
  id: string;
  amount: number;
  type: string;
  referenceId: string | null;
  balanceAfter: number;
  createdAt: string;
}

interface VerifyResult {
  newBalance: number;
  creditsAdded: number;
  plan: string;
  alreadyProcessed: boolean;
}

// RazorpayOptions / RazorpayResponse / RazorpayInstance / Window.Razorpay
// are declared globally in src/types/razorpay.d.ts

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  GENERATION:      "Content Generation",
  VIDEO_EXPORT:    "Video Export",
  VIDEO_SCENE:     "Video Scene Generation",
  STRATEGY:        "Strategy Generation",
  PLAN_ALLOCATION: "Monthly Plan Credits",
  PURCHASE:        "Credit Purchase",
  REFUND:          "Refund",
};

const PLAN_MAX: Record<string, number> = {
  FREE: 50,
  PRO: 500,
  BUSINESS: 2000,
};

const PLAN_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  FREE:     { bg: "bg-gray-100",   text: "text-gray-600",   label: "Free" },
  PRO:      { bg: "bg-[#E8F5EE]", text: "text-[#1A7A4A]",  label: "Pro" },
  BUSINESS: { bg: "bg-amber-50",  text: "text-amber-600",   label: "Business" },
};

const PAGE_SIZE = 20;

// Credit packs matching CREDIT_PACKS on the backend
const CREDIT_PACKS = [
  { amount: 179900, label: "Starter Pack", credits: 100, price: "₹1,799" },
  { amount: 349900, label: "Pro Pack",     credits: 250, price: "₹3,499" },
];

// Plan upgrade options matching PLAN_PRICES on the backend
const PLAN_UPGRADES: Array<{ plan: "PRO" | "BUSINESS"; label: string; credits: number; price: string }> = [
  { plan: "PRO",      label: "Pro Plan",      credits: 500,  price: "₹999/mo" },
  { plan: "BUSINESS", label: "Business Plan", credits: 2000, price: "₹2,499/mo" },
];

// ─── Credit Ring ──────────────────────────────────────────────────────────────

function CreditRing({ balance, max }: { balance: number; max: number }) {
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const pct = max > 0 ? Math.min(balance / max, 1) : 0;
  const offset = CIRC * (1 - pct);

  const isCritical = pct < 0.1;
  const isAmber    = pct >= 0.1 && pct < 0.3;
  const strokeColor = isCritical ? "#EF4444" : isAmber ? "#D97706" : "#1A7A4A";

  return (
    <div className="relative w-[128px] h-[128px] flex items-center justify-center flex-shrink-0">
      <svg width="128" height="128" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#F3F4F6" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={R}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          stroke={strokeColor}
          initial={{ strokeDashoffset: CIRC }}
          animate={{
            strokeDashoffset: offset,
            ...(isCritical ? { opacity: [1, 0.3, 1] } : { opacity: 1 }),
          }}
          transition={{
            strokeDashoffset: { duration: 1.4, ease: "easeOut" },
            opacity: isCritical
              ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 },
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-[#1A2E44] leading-none">{balance}</span>
      </div>
    </div>
  );
}

// ─── useRazorpay ──────────────────────────────────────────────────────────────

function useRazorpay() {
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.Razorpay);

  useEffect(() => {
    if (ready) return;
    if (document.getElementById("razorpay-sdk")) { setReady(true); return; }

    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload  = () => setReady(true);
    script.onerror = () => console.error("[Razorpay] Failed to load checkout SDK");
    document.head.appendChild(script);
  }, [ready]);

  return ready;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreditsPage() {
  const user          = useAuthStore((s) => s.user);
  const updateCredits = useAuthStore((s) => s.updateCredits);
  const setUser       = useAuthStore((s) => s.setUser);
  const razorpayReady = useRazorpay();

  const [creditsBalance, setCreditsBalance] = useState(user?.creditsBalance ?? 0);
  const [plan, setPlan]                     = useState(user?.plan ?? "FREE");
  const [planMax, setPlanMax]               = useState(PLAN_MAX[user?.plan ?? "FREE"] ?? 50);
  const [transactions, setTransactions]     = useState<CreditTransaction[]>([]);
  const [loading, setLoading]               = useState(true);
  const [payingId, setPayingId]             = useState<string | null>(null);
  const [payMsg, setPayMsg]                 = useState<{ text: string; ok: boolean } | null>(null);
  const [page, setPage]                     = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [balRes, histRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: { creditsBalance: number; plan: string; planMax: number } }>("/api/credits/balance"),
        apiClient.get<{ success: boolean; data: { transactions: CreditTransaction[] } }>("/api/credits/history"),
      ]);
      if (balRes.data.success && balRes.data.data) {
        const b = balRes.data.data;
        console.log(`[CreditsPage] loaded balance=${b.creditsBalance} plan=${b.plan} planMax=${b.planMax}`);
        setCreditsBalance(b.creditsBalance);
        setPlan(b.plan);
        setPlanMax(b.planMax);
        updateCredits(b.creditsBalance);
      }
      if (histRes.data.success && histRes.data.data) {
        setTransactions(histRes.data.data.transactions ?? []);
      }
    } catch (err) {
      console.error("[CreditsPage] Failed to load credit data:", err);
    } finally {
      setLoading(false);
    }
  }, [updateCredits]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Payment handler ─────────────────────────────────────────────────────────

  const openCheckout = useCallback(async (orderType: "pack" | "plan", amount: number, planKey?: "PRO" | "BUSINESS") => {
    if (!razorpayReady) { setPayMsg({ text: "Payment system loading, please wait…", ok: false }); return; }
    if (!user) return;

    const uid = orderType === "pack" ? `pack-${amount}` : planKey!;
    setPayingId(uid);
    setPayMsg(null);

    try {
      // 1. Create order on backend
      const endpoint = orderType === "pack" ? "/api/payments/create-pack-order" : "/api/payments/create-order";
      const body = orderType === "pack" ? { amount } : { plan: planKey };

      console.log(`[CreditsPage] Creating ${orderType} order`, body);

      const orderRes = await apiClient.post<{
        success: boolean;
        data: { orderId: string; amount: number; currency: string; keyId: string };
        error: string | null;
      }>(endpoint, body);

      if (!orderRes.data.success || !orderRes.data.data) {
        throw new Error(orderRes.data.error ?? "Failed to create order");
      }

      const { orderId, amount: orderAmount, keyId } = orderRes.data.data;
      console.log(`[CreditsPage] Order created — orderId=${orderId} amount=${orderAmount}`);

      // 2. Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: keyId,
          amount: orderAmount,
          currency: "INR",
          order_id: orderId,
          name: "BranDeFAI",
          description: orderType === "pack" ? "Credit Top-Up" : `${planKey} Plan Subscription`,
          prefill: { email: user.email },
          theme: { color: "#1A7A4A" },
          handler: async (response: RazorpayResponse) => {
            console.log("[CreditsPage] Checkout success, verifying payment…", response);
            try {
              // 3. Verify payment
              const verRes = await apiClient.post<{ success: boolean; data: VerifyResult; error: string | null }>(
                "/api/payments/verify",
                {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }
              );

              if (!verRes.data.success || !verRes.data.data) {
                throw new Error(verRes.data.error ?? "Verification failed");
              }

              const result = verRes.data.data;
              console.log(`[CreditsPage] Verified — newBalance=${result.newBalance} creditsAdded=${result.creditsAdded} plan=${result.plan}`);

              // 4. Update store and local state
              setCreditsBalance(result.newBalance);
              updateCredits(result.newBalance);
              if (user && result.plan !== user.plan) {
                setUser({ ...user, plan: result.plan, creditsBalance: result.newBalance });
                setPlan(result.plan);
                setPlanMax(PLAN_MAX[result.plan] ?? planMax);
              }

              setPayMsg({ text: `Payment successful! ${result.creditsAdded} credits added.`, ok: true });
              await loadData(); // reload history
              resolve();
            } catch (err) {
              console.error("[CreditsPage] Verify failed:", err);
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              console.log("[CreditsPage] Checkout dismissed by user");
              resolve();
            },
          },
        });
        rzp.open();
      });
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ?? (err as Error)?.message ?? "Payment failed";
      console.error("[CreditsPage] Payment error:", msg);
      setPayMsg({ text: msg, ok: false });
    } finally {
      setPayingId(null);
    }
  }, [razorpayReady, user, planMax, updateCredits, setUser, loadData]);

  const badge = PLAN_BADGE[plan] ?? PLAN_BADGE.FREE;
  const totalPages = Math.ceil(transactions.length / PAGE_SIZE);
  const paginated  = transactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pct = planMax > 0 ? Math.min((creditsBalance / planMax) * 100, 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Top Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <CreditRing balance={creditsBalance} max={planMax} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-[#1A2E44]">Credits</h1>
              <Badge variant={plan === "PRO" ? "green" : plan === "BUSINESS" ? "orange" : "gray"}>
                {badge.label}
              </Badge>
            </div>

            <p className="text-sm text-gray-500 mb-3">
              {creditsBalance.toLocaleString()} credits remaining
              {plan !== "FREE" && ` · resets on the 1st of each month`}
            </p>

            {/* Progress bar */}
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
              <motion.div
                className={cn("h-full rounded-full", pct < 10 ? "bg-red-500" : pct < 30 ? "bg-amber-400" : "bg-[#1A7A4A]")}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>

            <p className="text-xs text-gray-400 mb-4">
              {planMax.toLocaleString()} credits per month on {badge.label}
            </p>

            {/* Status message */}
            {payMsg && (
              <p className={cn("text-sm font-medium mb-3 px-3 py-2 rounded-xl", payMsg.ok ? "bg-[#E8F5EE] text-[#1A7A4A]" : "bg-red-50 text-red-600")}>
                {payMsg.text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Buy More Credits ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package size={16} className="text-[#1A7A4A]" />
          <h2 className="text-sm font-bold text-[#1A2E44]">Buy Credits</h2>
          <span className="text-xs text-gray-400">— one-time top-up, no plan change</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CREDIT_PACKS.map((pack) => {
            const pid = `pack-${pack.amount}`;
            return (
              <div key={pack.amount} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#1A2E44]">{pack.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pack.credits} credits · {pack.price}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={Zap}
                  isLoading={payingId === pid}
                  onClick={() => openCheckout("pack", pack.amount)}
                >
                  Buy
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Upgrade Plan ── */}
      {plan !== "BUSINESS" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-[#1A7A4A]" />
            <h2 className="text-sm font-bold text-[#1A2E44]">Upgrade Plan</h2>
            <span className="text-xs text-gray-400">— monthly credits reset</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLAN_UPGRADES.filter((u) => {
              if (plan === "PRO") return u.plan === "BUSINESS";
              return true;
            }).map((upgrade) => {
              const pid = upgrade.plan;
              return (
                <div key={upgrade.plan} className="border border-[#E8F5EE] bg-[#F8FDF9] rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[#1A2E44]">{upgrade.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{upgrade.credits} credits/mo · {upgrade.price}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={ArrowUpRight}
                    isLoading={payingId === pid}
                    onClick={() => openCheckout("plan", 0, upgrade.plan)}
                  >
                    Upgrade
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── History Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1A2E44]">Credit History</h2>
          {!loading && transactions.length > 0 && (
            <span className="text-xs text-gray-400">{transactions.length} transactions</span>
          )}
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-[#1A7A4A] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2">
            <Zap size={28} className="text-gray-200" />
            <p className="text-sm text-gray-400">No transactions yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <span>Action</span>
              <span className="text-right">Credits</span>
              <span className="text-right">Balance After</span>
              <span className="text-right">Date</span>
            </div>

            {paginated.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className={cn(
                    "grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-5 py-3 border-b border-gray-50 items-center hover:bg-gray-50/60 transition-colors",
                    isPositive ? "bg-[#F0FBF5]" : "bg-white"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A2E44] truncate">
                      {ACTION_LABELS[tx.type] ?? tx.type}
                    </p>
                    {tx.referenceId && (
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{tx.referenceId}</p>
                    )}
                  </div>

                  <span className={cn("text-sm font-bold tabular-nums text-right", isPositive ? "text-[#1A7A4A]" : "text-red-500")}>
                    {isPositive ? `+${tx.amount}` : tx.amount}
                  </span>

                  <span className="text-sm text-gray-500 tabular-nums text-right">
                    {tx.balanceAfter}
                  </span>

                  <span className="text-[11px] text-gray-400 text-right whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">Page {page + 1} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
