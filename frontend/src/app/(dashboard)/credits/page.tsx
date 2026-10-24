"use client";

import { useEffect, useState, useCallback } from "react";
import { Zap, ChevronLeft, ChevronRight, ArrowUpRight, Sparkles, Package, Check, AlertCircle, Loader2 } from "lucide-react";
import apiClient from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

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

const PLAN_BADGE: Record<string, { chip: string; label: string }> = {
  FREE: { chip: "", label: "Free" },
  PRO: { chip: "p", label: "Pro" },
  BUSINESS: { chip: "a", label: "Business" },
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
  const R = 62;
  const CIRC = 2 * Math.PI * R;
  const pct = max > 0 ? Math.min(balance / max, 1) : 0;
  const offset = CIRC * (1 - pct);

  const isCritical = pct < 0.1;
  const isAmber = pct >= 0.1 && pct < 0.3;
  const strokeColor = isCritical ? "#d92d20" : isAmber ? "#f5a524" : "#5235ef";

  return (
    <div className="bd-bigring">
      <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden>
        <circle cx="74" cy="74" r={R} fill="none" stroke="#e8e5fb" strokeWidth="11" />
        <circle
          cx="74" cy="74" r={R}
          fill="none"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          stroke={strokeColor}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="num">
        <span>{balance.toLocaleString()}<small>credits</small></span>
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
          name: "BrandefAI",
          description: orderType === "pack" ? "Credit Top-Up" : `${planKey} Plan Subscription`,
          prefill: { email: user.email },
          theme: { color: "#5235ef" },
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
  const paginated = transactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pct = planMax > 0 ? Math.min(creditsBalance / planMax, 1) : 0;

  return (
    <div className="bd-flow">
      <div className="bd-pagehead">
        <div>
          <h1>Credits &amp; billing</h1>
          <p>Credits power every caption, image and video. You&apos;re only charged when the AI delivers.</p>
        </div>
      </div>

      {/* ── Balance ── */}
      <div className="bd-card bd-credits-top bd-reveal">
        <CreditRing balance={creditsBalance} max={planMax} />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 className="bd-card-title" style={{ fontSize: 26 }}>
              {creditsBalance.toLocaleString()} credits remaining
            </h2>
            <span className={"bd-chip " + badge.chip}>{badge.label} plan</span>
          </div>
          <p className="bd-card-sub" style={{ marginTop: 6 }}>
            {plan !== "FREE" ? "Resets on the 1st of each month." : "Upgrade to get credits every month."}
          </p>
          <div className={"bd-bar" + (pct < 0.2 ? " is-low" : "")}>
            <span style={{ width: `${Math.max(pct * 100, 2)}%` }} />
          </div>
          <p className="bd-hint">{planMax.toLocaleString()} credits per month on {badge.label}</p>
          {payMsg && (
            <p className={"bd-msg " + (payMsg.ok ? "ok" : "err")} role="status">
              {payMsg.ok ? <Check size={16} /> : <AlertCircle size={16} />}
              {payMsg.text}
            </p>
          )}
        </div>
      </div>

      <div className="bd-grid-2">
        {/* ── Buy More Credits ── */}
        <div className="bd-card bd-reveal">
          <div className="bd-card-head">
            <div>
              <h2 className="bd-card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Package size={20} style={{ color: "var(--p)" }} /> Buy credits
              </h2>
              <p className="bd-card-sub">One-time top-up. No plan change.</p>
            </div>
          </div>
          {CREDIT_PACKS.map((pack) => {
            const pid = `pack-${pack.amount}`;
            return (
              <div key={pack.amount} className="bd-offer">
                <span className="ico"><Zap size={20} /></span>
                <div className="main">
                  <b>{pack.label}</b>
                  <span>{pack.credits} credits · {pack.price}</span>
                </div>
                <button className="bd-btn bd-btn-dark bd-btn-sm" onClick={() => openCheckout("pack", pack.amount)} disabled={payingId !== null}>
                  {payingId === pid ? <Loader2 size={14} className="bd-spin-icon" /> : null}
                  Buy
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Upgrade Plan ── */}
        {plan !== "BUSINESS" ? (
          <div className="bd-card bd-reveal">
            <div className="bd-card-head">
              <div>
                <h2 className="bd-card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Sparkles size={20} style={{ color: "var(--p)" }} /> Upgrade plan
                </h2>
                <p className="bd-card-sub">Get more credits every month.</p>
              </div>
            </div>
            {PLAN_UPGRADES.filter((u) => {
              if (plan === "PRO") return u.plan === "BUSINESS";
              return true;
            }).map((upgrade) => {
              const pid = upgrade.plan;
              return (
                <div key={upgrade.plan} className="bd-offer">
                  <span className="ico"><ArrowUpRight size={20} /></span>
                  <div className="main">
                    <b>{upgrade.label}</b>
                    <span>{upgrade.credits.toLocaleString()} credits/mo · {upgrade.price}</span>
                  </div>
                  <button className="bd-btn bd-btn-primary bd-btn-sm" onClick={() => openCheckout("plan", 0, upgrade.plan)} disabled={payingId !== null}>
                    {payingId === pid ? <Loader2 size={14} className="bd-spin-icon" /> : null}
                    Upgrade
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bd-card bd-reveal">
            <h2 className="bd-card-title">You&apos;re on our biggest plan</h2>
            <p className="bd-card-sub">Business includes {PLAN_MAX.BUSINESS.toLocaleString()} credits every month. Need more? Top up any time with a credit pack.</p>
          </div>
        )}
      </div>

      {/* ── History ── */}
      <div className="bd-card bd-reveal">
        <div className="bd-card-head">
          <div>
            <h2 className="bd-card-title">Credit history</h2>
            {!loading && transactions.length > 0 && <p className="bd-card-sub">{transactions.length} transactions</p>}
          </div>
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: 10 }}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="bd-skel" style={{ height: 44, borderRadius: 14 }} />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="bd-empty">
            <strong>No transactions yet</strong>
            Your credit activity will show up here.
          </div>
        ) : (
          <>
            <div className="bd-tbl">
              <div className="bd-tr head">
                <span>Action</span>
                <span>Credits</span>
                <span>Balance after</span>
                <span>Date</span>
              </div>
              {paginated.map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <div key={tx.id} className="bd-tr">
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontWeight: 600 }}>{ACTION_LABELS[tx.type] ?? tx.type}</b>
                      {tx.referenceId && <div className="bd-hint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.referenceId}</div>}
                    </div>
                    <span className={"amt " + (isPositive ? "plus" : "")}>{isPositive ? `+${tx.amount}` : tx.amount}</span>
                    <span>{tx.balanceAfter.toLocaleString()}</span>
                    <span style={{ color: "var(--gray)" }}>
                      {new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="bd-pager">
                <span>Page {page + 1} of {totalPages}</span>
                <div>
                  <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page">
                    <ChevronLeft size={15} />
                  </button>
                  <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} aria-label="Next page">
                    <ChevronRight size={15} />
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
