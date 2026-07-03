"use client";

import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, Check, Sun, Moon } from "lucide-react";
import { IconBrandInstagram, IconWorld } from "@tabler/icons-react";
import apiClient from "@/lib/apiClient";
import { useBrandStore } from "@/stores/brandStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import type { Brand } from "@/types";

// ─── Industry data ─────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { value: "Fashion & Apparel",        emoji: "👗" },
  { value: "Jewellery",                emoji: "💎" },
  { value: "Beauty & Skincare",        emoji: "💄" },
  { value: "Home Decor",               emoji: "🏡" },
  { value: "Food & Beverage",          emoji: "🍽️" },
  { value: "D2C Products",             emoji: "📦" },
  { value: "Health & Wellness",        emoji: "🌿" },
  { value: "Electronics & Tech",       emoji: "💻" },
  { value: "Baby & Kids",              emoji: "🍼" },
  { value: "Fitness & Sports",         emoji: "💪" },
  { value: "Luxury Goods",             emoji: "✨" },
  { value: "Handicrafts & Artisan",    emoji: "🪡" },
  { value: "Wedding & Celebrations",   emoji: "💍" },
  { value: "Interior Design",          emoji: "🛋️" },
  { value: "Education",                emoji: "📚" },
  { value: "Real Estate",              emoji: "🏠" },
  { value: "Restaurant & Cafe",        emoji: "☕" },
  { value: "Salon & Spa",              emoji: "💆" },
  { value: "Photography",              emoji: "📸" },
  { value: "Digital Services",         emoji: "🌐" },
  { value: "Retail Store",             emoji: "🛍️" },
  { value: "E-commerce Brand",         emoji: "🛒" },
  { value: "Personal Brand / Creator", emoji: "🎯" },
  { value: "Other",                    emoji: "🔮" },
] as const;

// ─── Tone data ─────────────────────────────────────────────────────────────────

type Tone =
  | "Professional" | "Playful" | "Inspirational" | "Bold"
  | "Minimal" | "Luxury" | "Witty";

const TONES: { value: Tone; tagline: string; example: string }[] = [
  { value: "Professional",  tagline: "Clear and authoritative",  example: "Trusted by thousands." },
  { value: "Playful",       tagline: "Fun and energetic",        example: "Let's gooo! 🚀" },
  { value: "Inspirational", tagline: "Motivating and uplifting", example: "You were born for this." },
  { value: "Bold",          tagline: "Direct and confident",     example: "No fluff. Just results." },
  { value: "Minimal",       tagline: "Clean and understated",    example: "Less is more." },
  { value: "Luxury",        tagline: "Elegant and premium",      example: "Crafted for the discerning few." },
  { value: "Witty",         tagline: "Clever with humour",       example: "We take our coffee seriously." },
];

// ─── Channel options ───────────────────────────────────────────────────────────

type ChannelChoice = "online" | "physical" | "both";

const CHANNELS: { value: ChannelChoice; emoji: string; label: string; sub: string }[] = [
  { value: "online",   emoji: "🌐", label: "Online Only",      sub: "Website, Instagram, marketplaces" },
  { value: "physical", emoji: "🏪", label: "Physical Store",   sub: "Walk-in shop or outlet" },
  { value: "both",     emoji: "🔀", label: "Both",             sub: "Online and in-store" },
];

function mapChannelToPlatforms(ch: ChannelChoice): string[] {
  if (ch === "online")   return ["Own Website", "Instagram Shop"];
  if (ch === "physical") return ["Offline / Retail"];
  return ["Own Website", "Instagram Shop", "Offline / Retail"];
}

// ─── Animation ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.25, ease: "easeOut" as const } },
  exit:   (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.2, ease: "easeIn" as const } }),
};

// ─── Inline theme toggle (no fixed positioning) ────────────────────────────────

function InlineThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("brandefai-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("brandefai-theme", "light");
    }
  }

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
      style={{
        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
      }}
    >
      {isDark
        ? <Sun size={16} style={{ color: "#f59e0b" }} />
        : <Moon size={16} style={{ color: "#64748b" }} />
      }
    </button>
  );
}

// ─── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s, i) => {
        const done    = step > s;
        const current = step === s;
        return (
          <Fragment key={s}>
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: done ? [1.2, 1] : 1 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className={cn(
                "relative w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all",
                done    ? "bg-[var(--accent-green)]"
                : current ? "border-2 border-[var(--primary)]"
                :           "border-2 border-[var(--border-color)]"
              )}
            >
              {done && (
                <svg viewBox="0 0 12 10" fill="none" className="w-3 h-2.5">
                  <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {current && (
                <motion.div
                  animate={{ scale: [1, 1.35, 1], opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]"
                />
              )}
            </motion.div>
            {i < TOTAL_STEPS - 1 && (
              <div className="relative mx-1.5 h-0.5 w-10 bg-[var(--border-color)] rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-[var(--accent-green)] rounded-full"
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-8 flex items-center gap-1.5 text-sm transition-colors"
      style={{ color: "var(--text-muted)" }}
    >
      ← Back
    </button>
  );
}

function PrimaryBtn({
  label = "Continue →",
  disabled,
  loading,
  onClick,
}: {
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 font-bold rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        height: 52,
        background: "var(--primary-btn)",
        fontSize: 15,
      }}
      onMouseEnter={(e) => { if (!disabled && !loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-btn-hover)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-btn)"; }}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {label}
    </button>
  );
}

function OutlineBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full flex items-center justify-center font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        height: 52,
        border: "1.5px solid var(--border-color)",
        color: "var(--text-secondary)",
        background: "transparent",
        fontSize: 14,
      }}
    >
      {label}
    </button>
  );
}

// ─── Loading overlay ───────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  "Reading your brand…",
  "Building your DNA…",
  "Almost ready…",
];

function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "var(--bg-base)" }}
    >
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="w-16 h-16 rounded-full mb-6"
        style={{ background: "var(--primary-glow)", border: "2px solid var(--primary)" }}
      />
      <p className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        Setting up your brand…
      </p>
      <AnimatePresence mode="wait">
        <motion.p
          key={msgIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {LOADING_MESSAGES[msgIdx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BrandSetupPage() {
  const router       = useRouter();
  const setBrand     = useBrandStore((s) => s.setBrand);
  const isAuthLoading    = useAuthStore((s) => s.isLoading);
  const isAuthenticated  = useAuthStore((s) => s.isAuthenticated);

  const [isChecking,   setIsChecking]   = useState(true);
  const [step,         setStep]         = useState(1);
  const [direction,    setDirection]    = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError,     setApiError]     = useState<string | null>(null);

  // Step 1: Brand Name + Industry
  const [brandName,    setBrandName]    = useState("");
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [customText,   setCustomText]   = useState("");
  const [searchQuery,  setSearchQuery]  = useState("");

  // Step 2: What You Sell
  const [whatTheySell, setWhatTheySell] = useState("");

  // Step 3: Brand Voice
  const [tone, setTone] = useState<Tone | null>(null);

  // Step 4: Channel
  const [channelChoice, setChannelChoice] = useState<ChannelChoice | null>(null);

  // Step 5: Optional URLs
  const [instagramInput, setInstagramInput] = useState("");
  const [websiteInput,   setWebsiteInput]   = useState("");

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) { router.replace("/login"); return; }

    apiClient
      .get<{ success: boolean; data: Brand | null }>("/api/brand")
      .then((res) => {
        if (res.data.success && res.data.data) router.replace("/dashboard");
        else setIsChecking(false);
      })
      .catch(() => setIsChecking(false));
  }, [router, isAuthLoading, isAuthenticated]);

  const filteredIndustries = useMemo(
    () =>
      searchQuery.trim()
        ? INDUSTRIES.filter((i) => i.value.toLowerCase().includes(searchQuery.toLowerCase()))
        : INDUSTRIES,
    [searchQuery]
  );

  const resolvedIndustry = customText.trim() || selectedTile;

  function goNext() { setDirection(1);  setStep((s) => s + 1); }
  function goBack() { setDirection(-1); setStep((s) => s - 1); }

  async function handleSubmit(opts?: { instagramUrl?: string; websiteUrl?: string }) {
    if (!resolvedIndustry || !tone || !channelChoice) return;
    setApiError(null);
    setIsSubmitting(true);
    const platforms   = mapChannelToPlatforms(channelChoice);
    const derivedAudience = `Customers interested in ${whatTheySell.trim() || resolvedIndustry}`;
    try {
      const res = await apiClient.post<{ success: boolean; data: Brand; error: string | null }>("/api/brand", {
        brandName:      brandName.trim(),
        industry:       resolvedIndustry,
        whatTheySell:   whatTheySell.trim() || undefined,
        targetAudience: derivedAudience,
        tone,
        platforms,
        instagramUrl:   opts?.instagramUrl || undefined,
        websiteUrl:     opts?.websiteUrl   || undefined,
      });
      if (res.data.success) {
        setBrand(res.data.data);
        router.push("/strategy");
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Something went wrong. Please try again.";
      setApiError(message);
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  if (isSubmitting) return <LoadingScreen />;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>

      {/* ── Left panel (desktop only) ──────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col w-[38%] min-h-screen px-10 py-12"
        style={{ background: "linear-gradient(160deg, #4338CA 0%, #312E81 100%)" }}
      >
        {/* Logo */}
        <div className="mb-10">
          <div className="text-white font-bold text-[28px] leading-none">BranDeFAI</div>
          <div className="text-white/60 text-[12px] mt-1 font-medium tracking-wide">AI Marketing</div>
        </div>

        <div className="w-12 h-px bg-white/20 mb-8" />

        {/* Feature lines */}
        <div className="space-y-4 flex-1">
          {[
            "Brand-specific content in seconds",
            "Hinglish captions that actually convert",
            "Promotional creatives with your logo",
          ].map((line) => (
            <div key={line} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <Check size={11} className="text-white" strokeWidth={2.5} />
              </div>
              <p className="text-white/85 text-[14px] leading-snug">{line}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-white/50 text-[11px] mt-auto">Trusted by Indian businesses</p>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>

        {/* Theme toggle top-right */}
        <div className="flex justify-end px-5 pt-4">
          <InlineThemeToggle />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
          <div className="w-full max-w-[480px]">

            <StepIndicator step={step} />

            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full"
              >

                {/* ── STEP 1: Brand Name + Industry ────────────────────────── */}
                {step === 1 && (
                  <div>
                    <h1 className="text-[28px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                      What&apos;s your business called?
                    </h1>
                    <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
                      This is how BranDeFAI will write for your brand
                    </p>

                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Ameeco, Belgee Jewellers, Tipanchu…"
                      maxLength={80}
                      autoFocus
                      className="block w-full text-[17px] outline-none transition-all rounded-xl px-4"
                      style={{
                        height: 56,
                        border: "1.5px solid var(--border-color)",
                        background: "var(--bg-surface)",
                        color: "var(--text-primary)",
                        marginBottom: 28,
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                      onBlur={(e)  => (e.target.style.borderColor = "var(--border-color)")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && brandName.trim().length >= 2 && resolvedIndustry) goNext();
                      }}
                    />

                    {/* Industry */}
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                      Industry
                    </p>

                    <div className="relative mb-3">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                      <input
                        type="text"
                        placeholder="Search industries…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
                        style={{
                          border: "1.5px solid var(--border-color)",
                          background: "var(--bg-card)",
                          color: "var(--text-primary)",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                        onBlur={(e)  => (e.target.style.borderColor = "var(--border-color)")}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5 max-h-[200px] overflow-y-auto pr-1">
                      {filteredIndustries.map((ind) => {
                        const sel = selectedTile === ind.value && !customText.trim();
                        return (
                          <button
                            key={ind.value}
                            type="button"
                            onClick={() => { setSelectedTile(ind.value); setCustomText(""); setSearchQuery(""); }}
                            className="relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium transition-all"
                            style={{
                              border: sel ? "2px solid var(--primary)" : "1.5px solid var(--border-color)",
                              background: sel ? "var(--primary-glow)" : "var(--bg-card)",
                              color: sel ? "var(--primary)" : "var(--text-secondary)",
                            }}
                          >
                            <span className="text-base leading-none">{ind.emoji}</span>
                            <span className="truncate">{ind.value}</span>
                            {sel && <Check size={10} className="ml-auto shrink-0" strokeWidth={2.5} />}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      placeholder="Or type your exact industry…"
                      value={customText}
                      onChange={(e) => { setCustomText(e.target.value); if (e.target.value.trim()) setSelectedTile(null); }}
                      maxLength={100}
                      className="w-full px-4 py-3 text-sm rounded-xl outline-none transition-all mb-6"
                      style={{
                        border: "1.5px solid var(--border-color)",
                        background: "var(--bg-card)",
                        color: "var(--text-primary)",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                      onBlur={(e)  => (e.target.style.borderColor = "var(--border-color)")}
                    />

                    <PrimaryBtn
                      disabled={brandName.trim().length < 2 || !resolvedIndustry}
                      onClick={goNext}
                    />
                  </div>
                )}

                {/* ── STEP 2: What You Sell ─────────────────────────────────── */}
                {step === 2 && (
                  <div>
                    <BackBtn onClick={goBack} />
                    <h1 className="text-[28px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                      What do you sell or offer?
                    </h1>
                    <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
                      Be specific — better input = better AI content
                    </p>

                    <input
                      type="text"
                      value={whatTheySell}
                      onChange={(e) => setWhatTheySell(e.target.value)}
                      placeholder="e.g. handmade gelato, gold jewellery, hair salon services…"
                      maxLength={200}
                      autoFocus
                      className="block w-full text-[17px] outline-none transition-all rounded-xl px-4 mb-8"
                      style={{
                        height: 56,
                        border: "1.5px solid var(--border-color)",
                        background: "var(--bg-surface)",
                        color: "var(--text-primary)",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                      onBlur={(e)  => (e.target.style.borderColor = "var(--border-color)")}
                      onKeyDown={(e) => { if (e.key === "Enter" && whatTheySell.trim().length >= 3) goNext(); }}
                    />

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={goBack}
                        className="flex-shrink-0 text-sm transition-colors"
                        style={{ color: "var(--text-muted)" }}
                      >
                        ← Back
                      </button>
                      <div className="flex-1">
                        <PrimaryBtn
                          disabled={whatTheySell.trim().length < 3}
                          onClick={goNext}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Brand Voice ───────────────────────────────────── */}
                {step === 3 && (
                  <div>
                    <BackBtn onClick={goBack} />
                    <h1 className="text-[28px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                      What&apos;s your brand vibe?
                    </h1>
                    <p className="text-sm mb-7" style={{ color: "var(--text-muted)" }}>
                      The AI will write in this voice for every post
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {TONES.map((t) => {
                        const selected = tone === t.value;
                        return (
                          <motion.button
                            key={t.value}
                            type="button"
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              setTone(t.value);
                              setTimeout(goNext, 150);
                            }}
                            className="relative flex items-start gap-3 rounded-xl px-5 py-4 text-left transition-all"
                            style={{
                              border: selected ? "2px solid var(--primary)" : "1.5px solid var(--border-color)",
                              background: selected ? "var(--primary-glow)" : "var(--bg-card)",
                            }}
                          >
                            {selected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: "var(--primary)" }}
                              >
                                <Check size={10} className="text-white" strokeWidth={2.5} />
                              </motion.div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-[14px]" style={{ color: selected ? "var(--primary)" : "var(--text-primary)" }}>
                                {t.value}
                              </p>
                              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {t.tagline}
                              </p>
                            </div>
                            <p className="text-[12px] italic shrink-0 max-w-[120px] text-right leading-snug" style={{ color: "var(--text-muted)" }}>
                              &ldquo;{t.example}&rdquo;
                            </p>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── STEP 4: Where Do You Sell ─────────────────────────────── */}
                {step === 4 && (
                  <div>
                    <BackBtn onClick={goBack} />
                    <h1 className="text-[28px] font-bold mb-7" style={{ color: "var(--text-primary)" }}>
                      Where do you sell?
                    </h1>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {CHANNELS.map((ch) => {
                        const selected = channelChoice === ch.value;
                        return (
                          <motion.button
                            key={ch.value}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            onClick={() => {
                              setChannelChoice(ch.value);
                              setTimeout(goNext, 150);
                            }}
                            className="relative flex flex-col items-center gap-2 rounded-xl px-4 py-6 transition-all"
                            style={{
                              border: selected ? "2px solid var(--primary)" : "1.5px solid var(--border-color)",
                              background: selected ? "var(--primary-glow)" : "var(--bg-card)",
                            }}
                          >
                            {selected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: "var(--primary)" }}
                              >
                                <Check size={10} className="text-white" strokeWidth={2.5} />
                              </motion.div>
                            )}
                            <span className="text-3xl leading-none">{ch.emoji}</span>
                            <div className="text-center">
                              <p className="font-bold text-[14px]" style={{ color: selected ? "var(--primary)" : "var(--text-primary)" }}>
                                {ch.label}
                              </p>
                              <p className="text-[12px] mt-0.5 leading-tight" style={{ color: "var(--text-muted)" }}>
                                {ch.sub}
                              </p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── STEP 5: Optional URL ─────────────────────────────────── */}
                {step === 5 && (
                  <div>
                    <BackBtn onClick={goBack} />
                    <h1 className="text-[28px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                      Want even better AI content?
                    </h1>
                    <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
                      Optional — takes 10 seconds, skippable
                    </p>

                    <div className="space-y-4 mb-8">
                      {/* Instagram */}
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
                          <IconBrandInstagram size={18} />
                        </div>
                        <input
                          type="text"
                          value={instagramInput}
                          onChange={(e) => setInstagramInput(e.target.value)}
                          placeholder="instagram.com/yourbusiness"
                          maxLength={200}
                          className="w-full pl-11 pr-4 py-3.5 text-sm rounded-xl outline-none transition-all"
                          style={{
                            border: "1.5px solid var(--border-color)",
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                          onBlur={(e)  => (e.target.style.borderColor = "var(--border-color)")}
                        />
                      </div>

                      {/* Website */}
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
                          <IconWorld size={18} />
                        </div>
                        <input
                          type="text"
                          value={websiteInput}
                          onChange={(e) => setWebsiteInput(e.target.value)}
                          placeholder="www.yourbusiness.com"
                          maxLength={200}
                          className="w-full pl-11 pr-4 py-3.5 text-sm rounded-xl outline-none transition-all"
                          style={{
                            border: "1.5px solid var(--border-color)",
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                          onBlur={(e)  => (e.target.style.borderColor = "var(--border-color)")}
                        />
                      </div>
                    </div>

                    {apiError && (
                      <p className="mb-5 text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
                        {apiError}
                      </p>
                    )}

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <OutlineBtn
                          label="Skip for now"
                          disabled={isSubmitting}
                          onClick={() => handleSubmit()}
                        />
                      </div>
                      <div className="flex-1">
                        <PrimaryBtn
                          label="Analyse My Brand →"
                          loading={isSubmitting}
                          disabled={!instagramInput.trim() && !websiteInput.trim()}
                          onClick={() =>
                            handleSubmit({
                              instagramUrl: instagramInput.trim() || undefined,
                              websiteUrl:   websiteInput.trim()   || undefined,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
