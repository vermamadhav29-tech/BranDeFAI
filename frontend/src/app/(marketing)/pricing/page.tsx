"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, ArrowRight, Loader2, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";

// RazorpayOptions / RazorpayResponse / RazorpayInstance / Window.Razorpay
// are declared globally in src/types/razorpay.d.ts

// ─── Constants ─────────────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const PLAN_DESCRIPTIONS: Record<"PRO" | "BUSINESS", string> = {
  PRO: "Pro Plan — 500 credits/month",
  BUSINESS: "Business Plan — 2,000 credits/month",
};

const PLAN_CREDITS: Record<"PRO" | "BUSINESS", number> = {
  PRO: 500,
  BUSINESS: 2000,
};

const FREE_FEATURES = [
  "3 AI-generated captions per batch",
  "1 batch generation",
  "Basic AI image generation",
  "Brand profile setup",
  "Content preview",
];

const PRO_FEATURES = [
  "Unlimited content batch generations",
  "Ad copy with targeting suggestions",
  "Reel ideas with full scene breakdowns",
  "All image styles (lifestyle, studio, editorial)",
  "30-day content calendar",
  "Instagram auto-posting",
  "Priority AI processing",
  "PDF & CSV export",
];

const BUSINESS_FEATURES = [
  "Everything in Pro",
  "AI video generation (Runway ML)",
  "Video timeline editor",
  "Advanced analytics dashboard",
  "Priority support & onboarding",
  "2,000 credits per month",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="razorpay"]')) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

// ─── SuccessModal ──────────────────────────────────────────────────────────────

function SuccessModal({
  plan,
  credits,
  onClose,
}: {
  plan: "PRO" | "BUSINESS";
  credits: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 24 }}
        transition={{ duration: 0.25, ease: EASE_OUT }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center relative overflow-hidden"
      >
        {/* Background ring decoration */}
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, #1A7A4A, transparent)" }}
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X size={16} />
        </button>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "linear-gradient(135deg, #1A7A4A, #34D399)" }}
        >
          <Check size={28} strokeWidth={3} className="text-white" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, ease: EASE_OUT }}
        >
          <h2 className="text-2xl font-extrabold text-[#1A2E44] mb-2 leading-tight">
            You&apos;re now on {plan === "PRO" ? "Pro" : "Business"}!
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            <span className="font-bold text-[#1A7A4A]">{credits.toLocaleString()} credits</span>{" "}
            have been added to your account.
          </p>

          <div className="bg-[#F0FDF4] rounded-2xl p-4 mb-6 border border-[#BBF7D0]">
            <div className="flex items-center gap-2 justify-center">
              <Zap size={14} className="text-[#1A7A4A]" />
              <span className="text-sm font-semibold text-[#1A7A4A]">
                Redirecting to dashboard…
              </span>
            </div>
            <div className="mt-2.5 h-1.5 bg-[#D1FAE5] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #1A7A4A, #34D399)" }}
              />
            </div>
          </div>

          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #1A7A4A, #145c38)" }}
          >
            Go to Dashboard <ArrowRight size={15} />
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── PlanCard ──────────────────────────────────────────────────────────────────

function PlanCard({
  variant,
  onUpgrade,
  isCurrentPlan,
  isAuthenticated,
  loading,
}: {
  variant: "FREE" | "PRO" | "BUSINESS";
  onUpgrade: (plan: "PRO" | "BUSINESS") => void;
  isCurrentPlan: boolean;
  isAuthenticated: boolean;
  loading: boolean;
}) {
  const isPro = variant === "PRO";
  const isBusiness = variant === "BUSINESS";
  const isFree = variant === "FREE";

  const borderStyle = isPro
    ? { border: "2px solid #1A7A4A", boxShadow: "0 8px 48px rgba(26,122,74,0.14)" }
    : isBusiness
    ? { border: "2px solid #1A2E44", boxShadow: "0 4px 24px rgba(26,46,68,0.08)" }
    : { border: "1px solid #E5E7EB" };

  const features = isFree ? FREE_FEATURES : isPro ? PRO_FEATURES : BUSINESS_FEATURES;

  function renderCTA() {
    if (isFree) {
      if (isCurrentPlan) {
        return (
          <div className="w-full py-3 rounded-xl text-sm font-semibold text-center bg-gray-100 text-gray-400 cursor-default select-none">
            Current Plan
          </div>
        );
      }
      return (
        <Link
          href="/login"
          className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #1A7A4A, #145c38)" }}
        >
          Get Started Free
        </Link>
      );
    }

    const planKey = isPro ? "PRO" : "BUSINESS";
    return (
      <button
        type="button"
        disabled={loading || isCurrentPlan}
        onClick={() => onUpgrade(planKey)}
        className={[
          "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200",
          isPro
            ? "text-white hover:opacity-90 active:scale-[0.98]"
            : "text-white hover:opacity-90 active:scale-[0.98]",
          isCurrentPlan ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
        style={
          isPro
            ? { background: "linear-gradient(135deg, #1A7A4A, #145c38)" }
            : { background: "linear-gradient(135deg, #1A2E44, #0f1e30)" }
        }
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Sparkles size={14} />
        )}
        {isCurrentPlan ? "Current Plan" : isPro ? "Upgrade to Pro" : "Upgrade to Business"}
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: isFree ? 0 : isPro ? 0.1 : 0.2, ease: EASE_OUT }}
      whileHover={!isCurrentPlan ? { y: -4, transition: { duration: 0.2 } } : undefined}
      className="relative bg-white rounded-3xl p-8 flex flex-col"
      style={borderStyle}
    >
      {/* Badge */}
      {isPro && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[#1A7A4A] text-white text-xs font-bold tracking-wide whitespace-nowrap">
          Most Popular
        </div>
      )}
      {isBusiness && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-white text-xs font-bold tracking-wide whitespace-nowrap"
          style={{ background: "#1A2E44" }}
        >
          Best Value
        </div>
      )}

      {/* Plan name */}
      <p className="text-xs font-bold uppercase tracking-widest mb-3"
        style={{ color: isPro ? "#1A7A4A" : isBusiness ? "#1A2E44" : "#9CA3AF" }}>
        {isFree ? "Free" : isPro ? "Pro" : "Business"}
      </p>

      {/* Price */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-5xl font-extrabold text-[#1A2E44] leading-none">
          {isFree ? "₹0" : isPro ? "₹999" : "₹2,499"}
        </span>
        <span className="text-gray-400 text-sm">/ month</span>
      </div>

      {/* Credits badge */}
      <span
        className="inline-block self-start text-xs font-bold px-3 py-1 rounded-full mt-2 mb-7"
        style={
          isPro
            ? { background: "#E8F5EE", color: "#1A7A4A" }
            : isBusiness
            ? { background: "#EFF6FF", color: "#1A2E44" }
            : { background: "#F3F4F6", color: "#6B7280" }
        }
      >
        {isFree ? "50 credits / month" : isPro ? "500 credits / month" : "2,000 credits / month"}
      </span>

      {/* Features */}
      <ul className="space-y-3 flex-1 mb-8">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check
              size={15}
              strokeWidth={2.5}
              className="shrink-0 mt-0.5"
              style={{ color: isPro ? "#1A7A4A" : isBusiness ? "#1A2E44" : "#9CA3AF" }}
            />
            <span className="text-sm text-gray-600 leading-snug">{f}</span>
          </li>
        ))}
      </ul>

      {renderCTA()}
    </motion.div>
  );
}

// ─── PricingPage ───────────────────────────────────────────────────────────────

export default function PricingPage() {
  const router = useRouter();
  const { user, isAuthenticated, setUser } = useAuthStore();
  const [loadingPlan, setLoadingPlan] = useState<"PRO" | "BUSINESS" | null>(null);
  const [successPlan, setSuccessPlan] = useState<"PRO" | "BUSINESS" | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: { user: typeof user } }>(
        "/api/auth/me"
      );
      if (res.data.success && res.data.data.user) {
        setUser(res.data.data.user);
      }
    } catch {
      // silently ignore — user stays as-is
    }
  }, [setUser]);

  const startPolling = useCallback(
    (orderId: string, plan: "PRO" | "BUSINESS") => {
      let attempts = 0;
      const MAX_ATTEMPTS = 30; // 60 seconds

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const res = await apiClient.get<{
            success: boolean;
            data: { status: string; plan: string };
          }>(`/api/payments/status/${orderId}`);

          if (res.data.data.status === "PAID") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            await refreshUser();
            setLoadingPlan(null);
            setSuccessPlan(plan);

            // Redirect after 3 seconds
            setTimeout(() => {
              router.push("/dashboard");
            }, 3000);
            return;
          }
        } catch {
          // network blip — keep polling
        }

        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setLoadingPlan(null);
          toast.error("Payment verification timed out", "Please contact support if you were charged.");
        }
      }, 2000);
    },
    [refreshUser, router]
  );

  async function handleUpgrade(plan: "PRO" | "BUSINESS") {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    setLoadingPlan(plan);

    try {
      // Step 1: Create backend order
      const orderRes = await apiClient.post<{
        success: boolean;
        data: { orderId: string; amount: number; currency: string; keyId: string };
      }>("/api/payments/create-order", { plan });

      if (!orderRes.data.success) throw new Error("Failed to create order");

      const { orderId, amount, currency, keyId } = orderRes.data.data;

      // Step 2: Load Razorpay SDK
      await loadRazorpayScript();

      if (!window.Razorpay) throw new Error("Razorpay SDK not available");

      // Step 3: Open checkout
      const rzp = new window.Razorpay({
        key: keyId,
        order_id: orderId,
        amount,
        currency,
        name: "BranDeFAI",
        description: PLAN_DESCRIPTIONS[plan],
        prefill: { email: user?.email ?? "" },
        theme: { color: "#1A7A4A" },
        handler: () => {
          // Step 4: Payment captured — start polling for webhook confirmation
          startPolling(orderId, plan);
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
            toast.error("Payment cancelled.", "Try again anytime.");
          },
        },
      });

      rzp.on("payment.failed", () => {
        setLoadingPlan(null);
        toast.error("Payment failed.", "Please try a different payment method.");
      });

      rzp.open();
    } catch (err: unknown) {
      setLoadingPlan(null);
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(
        "Could not initiate payment",
        e.response?.data?.error ?? e.message ?? "Please try again."
      );
    }
  }

  const currentPlan = user?.plan ?? "FREE";

  return (
    <>
      <main className="min-h-screen bg-white">
        {/* ── Subtle grid background ── */}
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            backgroundImage: [
              "linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "60px 60px",
          }}
        />
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(26,122,74,0.05) 0%, transparent 60%)",
          }}
        />

        {/* ── Navbar ── */}
        <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="text-[1.15rem] font-bold text-[#1A2E44] select-none">
              BranDe<span className="text-[#1A7A4A]">FAI</span>
            </Link>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="text-sm font-semibold text-white px-4 py-2 rounded-xl hover:opacity-90 transition-all"
                  style={{ background: "linear-gradient(135deg, #1A7A4A, #145c38)" }}
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-4 py-2 rounded-xl border border-gray-200 bg-white"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-white px-4 py-2 rounded-xl hover:opacity-90 transition-all"
                    style={{ background: "linear-gradient(135deg, #1A7A4A, #145c38)" }}
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* ── Hero heading ── */}
        <section className="pt-20 pb-14 px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-sm font-semibold text-[#1A7A4A]"
            style={{ background: "rgba(26,122,74,0.08)", border: "1px solid rgba(26,122,74,0.25)" }}
          >
            <Sparkles size={13} />
            Simple, transparent pricing
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: EASE_OUT }}
            className="text-5xl font-extrabold text-[#1A2E44] leading-tight mb-5"
          >
            Pick the plan that fits{" "}
            <span className="bg-gradient-to-r from-[#1A7A4A] to-[#34D399] bg-clip-text text-transparent">
              your brand.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14, ease: EASE_OUT }}
            className="text-gray-500 text-lg max-w-md mx-auto"
          >
            Start free. Upgrade when you&apos;re ready. Cancel anytime.
          </motion.p>
        </section>

        {/* ── Plan cards ── */}
        <section className="px-6 pb-24 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <PlanCard
              variant="FREE"
              onUpgrade={handleUpgrade}
              isCurrentPlan={currentPlan === "FREE"}
              isAuthenticated={isAuthenticated}
              loading={false}
            />
            <PlanCard
              variant="PRO"
              onUpgrade={handleUpgrade}
              isCurrentPlan={currentPlan === "PRO"}
              isAuthenticated={isAuthenticated}
              loading={loadingPlan === "PRO"}
            />
            <PlanCard
              variant="BUSINESS"
              onUpgrade={handleUpgrade}
              isCurrentPlan={currentPlan === "BUSINESS"}
              isAuthenticated={isAuthenticated}
              loading={loadingPlan === "BUSINESS"}
            />
          </div>

          {/* Trust line */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35, ease: EASE_OUT }}
            className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-gray-400"
          >
            {["Secure payments via Razorpay", "No hidden charges", "Cancel anytime", "GST invoice included"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check size={13} className="text-[#1A7A4A]" />
                {item}
              </span>
            ))}
          </motion.div>
        </section>

        {/* ── FAQ strip ── */}
        <section className="py-16 px-6 border-t border-gray-100 bg-[#F9FAFB]">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[#1A2E44] font-bold text-xl mb-2">Got questions?</p>
            <p className="text-gray-500 text-sm mb-6">
              Credits never expire within your billing period. Unused credits don&apos;t roll over, but you keep full access until the end of your paid period.
            </p>
            <a
              href="mailto:support@brandefai.com"
              className="text-sm font-semibold text-[#1A7A4A] hover:underline"
            >
              Contact support →
            </a>
          </div>
        </section>
      </main>

      {/* ── Success modal ── */}
      <AnimatePresence>
        {successPlan && (
          <SuccessModal
            plan={successPlan}
            credits={PLAN_CREDITS[successPlan]}
            onClose={() => {
              setSuccessPlan(null);
              router.push("/dashboard");
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
