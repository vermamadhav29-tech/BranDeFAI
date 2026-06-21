"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import Input from "@/components/ui/Input";
import type { User } from "@/types";

// ─── Schemas ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

// ─── Stagger helpers ───────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: EASE_OUT },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.45, delay },
});

// ─── Left side — brand panel ───────────────────────────────────────────────────

const floatingCards = [
  {
    rotate: -4,
    top: "18%",
    left: "8%",
    content: "✨ Caption for tonight's reel just dropped",
    sub: "AI wrote it in 2 seconds",
  },
  {
    rotate: 3,
    top: "42%",
    right: "6%",
    content: "📅 30-day calendar ready",
    sub: "All slots filled automatically",
  },
  {
    rotate: -2,
    bottom: "22%",
    left: "12%",
    content: "📱 Posted to Instagram",
    sub: "Engagement up 34% this week",
  },
];

function FloatingCard({
  card,
  delay,
}: {
  card: (typeof floatingCards)[0];
  delay: number;
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    rotate: `${card.rotate}deg`,
    ...(card.top && { top: card.top }),
    ...(card.bottom && { bottom: card.bottom }),
    ...(card.left && { left: card.left }),
    ...(card.right && { right: card.right }),
  };

  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: EASE_OUT }}
    >
      <div
        className="backdrop-blur-md rounded-xl px-4 py-3 text-white text-xs font-medium shadow-lg"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.14)",
          minWidth: 190,
        }}
      >
        <div className="font-semibold text-sm mb-0.5">{card.content}</div>
        <div style={{ color: "rgba(255,255,255,0.6)" }}>{card.sub}</div>
      </div>
    </motion.div>
  );
}

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex flex-col relative overflow-hidden"
      style={{ background: "#0F172A", flex: "0 0 50%" }}
    >
      {/* radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 60% at 40% 50%, rgba(26,122,74,0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* logo */}
      <motion.div {...fadeIn(0.1)} className="relative z-10 p-10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: "#1A7A4A" }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-12 5" />
            </svg>
          </div>
          <span className="text-white text-xl font-bold tracking-tight">
            BranDeFAI
          </span>
        </div>
      </motion.div>

      {/* center copy */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-12 pb-8">
        <motion.h1
          {...fadeUp(0.2)}
          className="text-5xl font-extrabold leading-tight mb-3"
        >
          <span
            style={{
              background: "linear-gradient(135deg, #4ADE80 0%, #1A7A4A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Your brand.
          </span>
          <br />
          <span className="text-white">Fully automated.</span>
        </motion.h1>

        <motion.p
          {...fadeUp(0.32)}
          style={{ color: "rgba(255,255,255,0.55)", maxWidth: 360 }}
          className="text-base leading-relaxed"
        >
          Captions, images, reels and Instagram posts — all on autopilot.
        </motion.p>

        {/* feature pills */}
        <motion.div {...fadeUp(0.44)} className="flex flex-wrap gap-3 mt-10">
          {[
            { icon: "✨", label: "AI Content" },
            { icon: "📅", label: "Auto Calendar" },
            { icon: "📱", label: "Instagram Posting" },
          ].map((pill) => (
            <div
              key={pill.label}
              className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <span>{pill.icon}</span>
              <span>{pill.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* floating cards */}
      {floatingCards.map((card, i) => (
        <FloatingCard key={i} card={card} delay={0.55 + i * 0.12} />
      ))}
    </div>
  );
}

// ─── Google button ─────────────────────────────────────────────────────────────

function GoogleButton({ delay }: { delay: number }) {
  function handleGoogleLogin() {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`;
  }

  return (
    <motion.button
      type="button"
      onClick={handleGoogleLogin}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
        <path fill="#FBBC05" d="M3.964 10.71C3.786 10.17 3.682 9.593 3.682 9s.104-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
      </svg>
      Continue with Google
    </motion.button>
  );
}

// ─── OR divider ────────────────────────────────────────────────────────────────

function OrDivider({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center gap-3"
    >
      <div className="flex-1 h-px bg-gray-100" />
      <span className="text-xs text-gray-400 font-medium">OR</span>
      <div className="flex-1 h-px bg-gray-100" />
    </motion.div>
  );
}

// ─── Sign In Form ──────────────────────────────────────────────────────────────

function SignInForm({ onShake }: { onShake: () => void }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (data) => {
    setApiError(null);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { userId: string; email: string; plan: string; creditsBalance: number };
        error: string | null;
      }>("/api/auth/login", data);
      if (res.data.success) {
        const { userId, email, plan, creditsBalance } = res.data.data;
        setUser({ id: userId, email, plan, creditsBalance });
        try {
          const brand = await apiClient.get<{ success: boolean; data: unknown }>("/api/brand");
          router.push(brand.data.success && brand.data.data ? "/dashboard" : "/brand-setup");
        } catch {
          router.push("/brand-setup");
        }
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Sign in failed. Please try again.";
      setApiError(message);
      onShake();
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
      >
        <Input
          id="login-email"
          label="Email address"
          type="email"
          error={errors.email?.message}
          {...register("email")}
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18, ease: "easeOut" }}
      >
        <Input
          id="login-password"
          label="Password"
          type="password"
          error={errors.password?.message}
          {...register("password")}
        />
      </motion.div>

      <AnimatePresence>
        {apiError && (
          <motion.p
            key="err"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5"
          >
            {apiError}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={isSubmitting}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.26 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-center gap-2 text-white font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: isSubmitting ? "#145C38" : "#1A7A4A" }}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign In"
        )}
      </motion.button>

      <OrDivider delay={0.32} />
      <GoogleButton delay={0.36} />
    </form>
  );
}

// ─── Register Form ─────────────────────────────────────────────────────────────

function RegisterForm({ onShake }: { onShake: () => void }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (data) => {
    setApiError(null);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { userId: string; email: string; plan: string; creditsBalance?: number };
        error: string | null;
      }>("/api/auth/register", { email: data.email, password: data.password });
      if (res.data.success) {
        const { userId, email, plan, creditsBalance } = res.data.data;
        setUser({ id: userId, email, plan, creditsBalance: creditsBalance ?? 50 });
        router.push("/brand-setup");
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Registration failed. Please try again.";
      setApiError(message);
      onShake();
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
      >
        <Input
          id="reg-email"
          label="Email address"
          type="email"
          error={errors.email?.message}
          {...register("email")}
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18, ease: "easeOut" }}
      >
        <Input
          id="reg-password"
          label="Password (min. 8 characters)"
          type="password"
          error={errors.password?.message}
          {...register("password")}
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.26, ease: "easeOut" }}
      >
        <Input
          id="reg-confirm"
          label="Confirm password"
          type="password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </motion.div>

      <AnimatePresence>
        {apiError && (
          <motion.p
            key="err"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5"
          >
            {apiError}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={isSubmitting}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.34 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-center gap-2 text-white font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: isSubmitting ? "#145C38" : "#1A7A4A" }}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Creating account…
          </>
        ) : (
          "Create Account"
        )}
      </motion.button>
    </form>
  );
}

// ─── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "signin" | "register";

// ─── Right side — form panel ───────────────────────────────────────────────────

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_failed: "Google sign-in failed. Please try again.",
};

function FormPanel() {
  const [tab, setTab] = useState<Tab>("signin");
  const [shakeKey, setShakeKey] = useState(0);
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const triggerShake = () => setShakeKey((k) => k + 1);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease: EASE_OUT }}
      className="flex-1 flex items-center justify-center bg-white px-6 py-12"
    >
      <div className="w-full" style={{ maxWidth: 400 }}>
        {/* mobile logo */}
        <motion.div {...fadeUp(0.05)} className="flex items-center gap-2 mb-8 lg:hidden">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "#1A7A4A" }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-12 5" />
            </svg>
          </div>
          <span className="text-lg font-bold text-[#1A2E44] tracking-tight">BranDeFAI</span>
        </motion.div>

        {/* heading */}
        <motion.div {...fadeUp(0.08)} className="mb-7">
          <AnimatePresence mode="wait">
            <motion.h2
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="text-2xl font-bold text-[#1A2E44]"
            >
              {tab === "signin" ? "Welcome back" : "Create your account"}
            </motion.h2>
          </AnimatePresence>
          <p className="text-sm text-gray-400 mt-1">
            {tab === "signin"
              ? "Sign in to your BranDeFAI account"
              : "Start automating your brand today"}
          </p>
        </motion.div>

        {/* OAuth error banner */}
        {oauthError && GOOGLE_ERROR_MESSAGES[oauthError] && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4"
          >
            {GOOGLE_ERROR_MESSAGES[oauthError]}
          </motion.p>
        )}

        {/* tabs */}
        <motion.div {...fadeIn(0.14)} className="flex border-b border-gray-100 mb-6">
          {(["signin", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-[#1A7A4A] text-[#1A7A4A]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </motion.div>

        {/* shaking form wrapper */}
        <motion.div
          key={shakeKey}
          animate={
            shakeKey > 0
              ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
              : { x: 0 }
          }
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <AnimatePresence mode="wait">
            {tab === "signin" ? (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
              >
                <SignInForm onShake={triggerShake} />
              </motion.div>
            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
              >
                <RegisterForm onShake={triggerShake} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      <BrandPanel />
      <FormPanel />
    </div>
  );
}
