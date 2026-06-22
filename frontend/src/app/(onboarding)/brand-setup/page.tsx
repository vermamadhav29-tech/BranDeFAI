"use client";

import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, Check, Upload, X, ImageIcon, Sparkles, RefreshCw } from "lucide-react";
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

// ─── Platform data ─────────────────────────────────────────────────────────────

const PLATFORMS = [
  { value: "Own Website",       emoji: "🌐" },
  { value: "Instagram Shop",    emoji: "📱" },
  { value: "Amazon",            emoji: "📦" },
  { value: "Flipkart",          emoji: "🛍️" },
  { value: "Meesho",            emoji: "🏪" },
  { value: "Myntra",            emoji: "👗" },
  { value: "Shopify Store",     emoji: "🟢" },
  { value: "Facebook Shop",     emoji: "📘" },
  { value: "WhatsApp Business", emoji: "💬" },
  { value: "Offline / Retail",  emoji: "🏢" },
  { value: "Etsy",              emoji: "🎨" },
  { value: "Other",             emoji: "🔮" },
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

// ─── Animation ─────────────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.38, ease: EASE_OUT },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
    transition: { duration: 0.22, ease: "easeIn" as const },
  }),
};

const TOTAL_STEPS = 5;

// ─── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-center mb-12">
      {steps.map((s, i) => {
        const done = step > s;
        const current = step === s;

        return (
          <Fragment key={s}>
            <motion.div
              key={`c-${s}-${done}`}
              initial={{ scale: done ? 1.25 : 1 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className={`relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                done
                  ? "bg-[#1A7A4A]"
                  : current
                  ? "border-2 border-[#1A7A4A]"
                  : "border-2 border-gray-200"
              }`}
            >
              {done && (
                <svg viewBox="0 0 12 10" fill="none" className="w-3.5 h-3">
                  <path
                    d="M1 5l3.5 3.5L11 1"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {current && (
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.9, 0.4, 0.9] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="w-2.5 h-2.5 rounded-full bg-[#1A7A4A]"
                />
              )}
            </motion.div>

            {i < TOTAL_STEPS - 1 && (
              <div className="relative mx-1 h-0.5 w-10 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-[#1A7A4A] rounded-full"
                  initial={false}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Shared UI pieces ──────────────────────────────────────────────────────────

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-8 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
    >
      ← Back
    </button>
  );
}

function ContinueBtn({
  label = "Continue",
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
    <div className="flex justify-center mt-8">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={onClick}
        className="w-full max-w-xs flex items-center justify-center gap-2 bg-[#1A7A4A] hover:bg-[#145C38] text-white font-semibold rounded-xl py-3.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        {label}
      </button>
    </div>
  );
}

function SkipBtn({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center mt-3">
      <button
        type="button"
        onClick={onClick}
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        I will add this later →
      </button>
    </div>
  );
}

// ─── Toggle Tile ───────────────────────────────────────────────────────────────

function ToggleTile({
  emoji,
  label,
  selected,
  multi,
  onClick,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 py-4 px-3 transition-all ${
        selected
          ? "border-[#1A7A4A] bg-[#E8F5EE] text-[#1A7A4A]"
          : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-gray-100"
      }`}
    >
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center ${
              multi ? "bg-[#1A7A4A]" : "bg-[#1A7A4A]"
            }`}
          >
            <Check size={9} strokeWidth={3} className="text-white" />
          </motion.div>
        )}
      </AnimatePresence>
      <span className="text-2xl leading-none select-none">{emoji}</span>
      <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
    </motion.button>
  );
}

// ─── AI Generate Button ────────────────────────────────────────────────────────

function AiGenerateBtn({
  generating,
  generated,
  onClick,
}: {
  generating: boolean;
  generated: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={generating}
      className={cn(
        "flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
        generated
          ? "text-[#1A7A4A] hover:text-[#145C38]"
          : "text-[#1A7A4A] hover:text-[#145C38]"
      )}
    >
      {generating ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          <span>Generating…</span>
        </>
      ) : generated ? (
        <>
          <RefreshCw size={12} />
          <span>Regenerate</span>
        </>
      ) : (
        <>
          <motion.span
            animate={{ opacity: [1, 0.45, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center gap-1.5"
          >
            <Sparkles size={12} />
            Let AI fill this for you
          </motion.span>
        </>
      )}
    </button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BrandSetupPage() {
  const router = useRouter();
  const setBrand = useBrandStore((s) => s.setBrand);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // DIAGNOSTIC — remove after issue is confirmed
  console.log("[brand-setup] render — isAuthLoading:", isAuthLoading, "isAuthenticated:", isAuthenticated);

  const [isChecking, setIsChecking] = useState(true);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Step 1: Brand Name + Industry
  const [brandName, setBrandName] = useState("");
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2: Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Step 3: Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Step 4: Tone
  const [tone, setTone] = useState<Tone | null>(null);

  // Step 5: Target Audience + Brand Brief
  const [targetAudience, setTargetAudience] = useState("");
  const [brandBrief, setBrandBrief] = useState("");
  const [audienceGenerating, setAudienceGenerating] = useState(false);
  const [audienceGenerated, setAudienceGenerated] = useState(false);
  const [briefGenerating, setBriefGenerating] = useState(false);
  const [briefGenerated, setBriefGenerated] = useState(false);

  useEffect(() => {
    console.log("[brand-setup] effect fired — isAuthLoading:", isAuthLoading, "isAuthenticated:", isAuthenticated);

    // Wait for auth to fully settle before acting — mirrors DashboardShell's guard.
    // The transient { isLoading: false, isAuthenticated: false } window that occurs
    // briefly after the OAuth callback (before /me resolves) must not trigger a
    // redirect. Waiting whenever isLoading is true covers all transient states.
    if (isAuthLoading) {
      console.log("[brand-setup] waiting for auth to settle...");
      return;
    }

    if (!isAuthenticated) {
      // Auth settled and user is genuinely not logged in — redirect to login.
      console.warn("[brand-setup] not authenticated — redirecting to /login");
      router.replace("/login");
      return;
    }

    console.log("[brand-setup] auth confirmed — checking for existing brand");
    apiClient
      .get<{ success: boolean; data: Brand | null }>("/api/brand")
      .then((res) => {
        console.log("[brand-setup] GET /api/brand →", res.status, res.data);
        if (res.data.success && res.data.data) {
          router.replace("/dashboard");
        } else {
          setIsChecking(false);
        }
      })
      .catch((err) => {
        console.error("[brand-setup] GET /api/brand failed →", err?.response?.status, err?.response?.data ?? err?.message);
        setIsChecking(false);
      });
  }, [router, isAuthLoading, isAuthenticated]);

  const filteredIndustries = useMemo(
    () =>
      searchQuery.trim()
        ? INDUSTRIES.filter((i) =>
            i.value.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : INDUSTRIES,
    [searchQuery]
  );

  const resolvedIndustry = customText.trim() || selectedTile;

  function goNext() {
    setDirection(1);
    setStep((s) => s + 1);
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => s - 1);
  }

  function togglePlatform(value: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  }

  const handleLogoUpload = useCallback(async (file: File) => {
    const allowed = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setLogoUploadError("Only PNG, SVG, JPEG, and WebP are accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoUploadError("Logo must be 2 MB or smaller.");
      return;
    }
    setLogoUploading(true);
    setLogoUploadError(null);
    setLogoUrl(null);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await apiClient.post<{
        success: boolean;
        data: { logoUrl: string };
        error: string | null;
      }>("/api/uploads/brand-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success && res.data.data) {
        setLogoUrl(res.data.data.logoUrl);
      } else {
        setLogoUploadError(res.data.error ?? "Upload failed. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setLogoUploadError(e.response?.data?.error ?? e.message ?? "Upload failed.");
    } finally {
      setLogoUploading(false);
    }
  }, []);

  async function handleGenerateField(field: "targetAudience" | "brandBrief") {
    if (!resolvedIndustry || !tone) return;
    if (field === "targetAudience") setAudienceGenerating(true);
    else setBriefGenerating(true);

    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { text: string };
        error: string | null;
      }>("/api/brand/generate-field", {
        brandName: brandName.trim() || "My Brand",
        industry: resolvedIndustry,
        tone,
        platforms: selectedPlatforms,
        field,
      });

      if (res.data.success && res.data.data?.text) {
        if (field === "targetAudience") {
          setTargetAudience(res.data.data.text);
          setAudienceGenerated(true);
        } else {
          setBrandBrief(res.data.data.text.slice(0, 500));
          setBriefGenerated(true);
        }
      }
    } catch {
      // silently fail — user can retry
    } finally {
      if (field === "targetAudience") setAudienceGenerating(false);
      else setBriefGenerating(false);
    }
  }

  async function handleSubmit() {
    if (!resolvedIndustry || !tone) return;
    setApiError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: Brand;
        error: string | null;
      }>("/api/brand", {
        brandName: brandName.trim(),
        industry: resolvedIndustry,
        targetAudience: targetAudience.trim(),
        tone,
        platforms: selectedPlatforms,
        brandBrief: brandBrief.trim() || undefined,
        logoUrl: logoUrl || undefined,
      });
      if (res.data.success) {
        setBrand(res.data.data);
        router.push("/strategy");
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Something went wrong. Please try again.";
      setApiError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#1A7A4A]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl">
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

              {/* ── STEP 1: Brand Name + Industry ─────────────────────────── */}
              {step === 1 && (
                <div>
                  <h1 className="text-3xl font-bold text-[#1A2E44] mb-2">
                    Let&apos;s set up your brand
                  </h1>
                  <p className="text-sm text-gray-400 mb-8">
                    Start with the basics — name and industry
                  </p>

                  {/* Brand name */}
                  <div className="mb-8">
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      Brand Name
                    </label>
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Urban Threads"
                      maxLength={80}
                      autoFocus
                      className="block w-full text-xl border-b-2 border-gray-200 focus:border-[#1A7A4A] outline-none pb-3 pt-1 bg-transparent transition-colors placeholder:text-gray-200 text-[#1A2E44]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && brandName.trim().length >= 2 && resolvedIndustry) goNext();
                      }}
                    />
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      Industry
                    </label>
                    <p className="text-xs text-gray-400 mb-4">
                      Pick a category — or type your exact niche below
                    </p>

                    {/* Search bar */}
                    <div className="relative mb-4">
                      <Search
                        size={14}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                      <input
                        type="text"
                        placeholder="Search industries…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-[#1A7A4A] focus:bg-white transition-colors placeholder:text-gray-300 text-gray-700"
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      {filteredIndustries.map((ind) => {
                        const isSelected = selectedTile === ind.value && !customText.trim();
                        return (
                          <ToggleTile
                            key={ind.value}
                            emoji={ind.emoji}
                            label={ind.value}
                            selected={isSelected}
                            onClick={() => {
                              setSelectedTile(ind.value);
                              setCustomText("");
                              setSearchQuery("");
                            }}
                          />
                        );
                      })}
                      {filteredIndustries.length === 0 && (
                        <div className="col-span-2 md:col-span-4 py-8 text-center text-sm text-gray-400">
                          No match — type your industry in the field below ↓
                        </div>
                      )}
                    </div>

                    {/* Custom industry input */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        My industry is not listed — type it here
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g. Organic Cotton Kidswear, Pet Accessories…"
                          value={customText}
                          onChange={(e) => {
                            setCustomText(e.target.value);
                            if (e.target.value.trim()) setSelectedTile(null);
                          }}
                          maxLength={100}
                          className="w-full px-4 py-3 pr-10 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-[#1A7A4A] focus:bg-white transition-colors placeholder:text-gray-300 text-gray-700"
                        />
                        <AnimatePresence>
                          {customText.trim() && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 20 }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#1A7A4A] flex items-center justify-center"
                            >
                              <Check size={10} strokeWidth={3} className="text-white" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {customText.trim() && (
                        <p className="mt-2 text-xs text-[#1A7A4A] font-medium">
                          Will be saved as: &ldquo;{customText.trim()}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <ContinueBtn
                    disabled={brandName.trim().length < 2 || !resolvedIndustry}
                    onClick={goNext}
                  />
                </div>
              )}

              {/* ── STEP 2: Logo Upload ───────────────────────────────────── */}
              {step === 2 && (
                <div>
                  <BackBtn onClick={goBack} />
                  <h1 className="text-3xl font-bold text-[#1A2E44] mb-2">
                    Upload your brand logo
                  </h1>
                  <p className="text-sm text-gray-400 mb-6">
                    PNG or SVG with transparent background recommended · Max 2 MB
                  </p>

                  {/* Hidden file input */}
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />

                  {/* Upload area */}
                  {!logoUrl ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => !logoUploading && logoFileRef.current?.click()}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") &&
                        !logoUploading &&
                        logoFileRef.current?.click()
                      }
                      onDragOver={(e) => {
                        e.preventDefault();
                        setLogoDragOver(true);
                      }}
                      onDragLeave={() => setLogoDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setLogoDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleLogoUpload(file);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-14 px-8 cursor-pointer select-none transition-all duration-150",
                        logoUploading
                          ? "border-[#1A7A4A]/40 bg-[#E8F5EE]/50 cursor-default"
                          : logoDragOver
                          ? "border-[#1A7A4A] bg-[#E8F5EE]/60"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      {logoUploading ? (
                        <>
                          <Loader2 size={28} className="text-[#1A7A4A] animate-spin" />
                          <p className="text-sm text-[#1A7A4A] font-medium">Uploading…</p>
                        </>
                      ) : (
                        <>
                          <div
                            className={cn(
                              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
                              logoDragOver
                                ? "bg-[#E8F5EE] text-[#1A7A4A]"
                                : "bg-gray-100 text-gray-400"
                            )}
                          >
                            <Upload size={24} />
                          </div>
                          <div className="text-center">
                            <p className={cn(
                              "text-sm font-semibold transition-colors",
                              logoDragOver ? "text-[#1A7A4A]" : "text-gray-600"
                            )}>
                              Click to upload or drag &amp; drop
                            </p>
                            <p className="text-xs text-gray-400 mt-1">PNG · SVG · JPEG · WebP</p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Logo uploaded — show preview on light + dark bg */
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Light background preview */}
                        <div className="rounded-2xl bg-white border-2 border-gray-100 flex items-center justify-center p-6 h-36">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logoUrl}
                            alt="Logo on light background"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        {/* Dark background preview */}
                        <div className="rounded-2xl bg-[#1A2E44] flex items-center justify-center p-6 h-36">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logoUrl}
                            alt="Logo on dark background"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-sm text-[#1A7A4A] font-medium">
                          <div className="w-5 h-5 rounded-full bg-[#1A7A4A] flex items-center justify-center shrink-0">
                            <Check size={11} strokeWidth={3} className="text-white" />
                          </div>
                          Logo uploaded successfully
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setLogoUrl(null);
                            setLogoUploadError(null);
                            if (logoFileRef.current) logoFileRef.current.value = "";
                          }}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X size={13} />
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    {logoUploadError && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2.5 overflow-hidden"
                      >
                        {logoUploadError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <ContinueBtn
                    disabled={logoUploading}
                    onClick={goNext}
                  />
                  <SkipBtn onClick={goNext} />
                </div>
              )}

              {/* ── STEP 3: Where do you sell? ────────────────────────────── */}
              {step === 3 && (
                <div>
                  <BackBtn onClick={goBack} />
                  <h1 className="text-3xl font-bold text-[#1A2E44] mb-2">
                    Where do you sell?
                  </h1>
                  <p className="text-sm text-gray-400 mb-6">
                    Select all that apply — this helps tailor your content format
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PLATFORMS.map((p) => (
                      <ToggleTile
                        key={p.value}
                        emoji={p.emoji}
                        label={p.value}
                        selected={selectedPlatforms.includes(p.value)}
                        multi
                        onClick={() => togglePlatform(p.value)}
                      />
                    ))}
                  </div>

                  {selectedPlatforms.length > 0 && (
                    <p className="mt-4 text-xs text-[#1A7A4A] font-medium">
                      {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? "s" : ""} selected
                    </p>
                  )}

                  <ContinueBtn onClick={goNext} />
                  <SkipBtn onClick={goNext} />
                </div>
              )}

              {/* ── STEP 4: Brand Tone ─────────────────────────────────────── */}
              {step === 4 && (
                <div>
                  <BackBtn onClick={goBack} />
                  <h1 className="text-3xl font-bold text-[#1A2E44] mb-6">
                    What is your brand&apos;s voice?
                  </h1>
                  <div className="grid grid-cols-1 gap-2.5 max-w-lg mx-auto">
                    {TONES.map((t) => {
                      const selected = tone === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setTone(t.value)}
                          className={`flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all ${
                            selected
                              ? "border-[#1A7A4A] bg-[#E8F5EE]"
                              : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div
                              className={`font-semibold text-sm ${
                                selected ? "text-[#1A7A4A]" : "text-[#1A2E44]"
                              }`}
                            >
                              {t.value}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{t.tagline}</div>
                          </div>
                          <div className="text-xs text-gray-400 italic text-right shrink-0 max-w-[140px]">
                            &ldquo;{t.example}&rdquo;
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <ContinueBtn disabled={!tone} onClick={goNext} />
                </div>
              )}

              {/* ── STEP 5: Target Audience + Brand Brief ─────────────────── */}
              {step === 5 && (
                <div>
                  <BackBtn onClick={goBack} />
                  <h1 className="text-3xl font-bold text-[#1A2E44] mb-2">
                    Tell us about your audience
                  </h1>
                  <p className="text-sm text-gray-400 mb-6">
                    The more specific you are, the better the AI output
                  </p>

                  <div className="space-y-6">
                    {/* Target Audience */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Who are you trying to reach?
                        </label>
                        <AiGenerateBtn
                          generating={audienceGenerating}
                          generated={audienceGenerated}
                          onClick={() => handleGenerateField("targetAudience")}
                        />
                      </div>
                      <textarea
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value.slice(0, 400))}
                        rows={4}
                        maxLength={400}
                        placeholder="e.g. Women aged 25-40 who care about sustainable fashion and shop online for premium everyday wear…"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#1A2E44] placeholder:text-gray-300 resize-none outline-none focus:border-[#1A7A4A] focus:bg-white transition-colors leading-relaxed"
                      />
                      <p className="text-right text-[11px] text-gray-300 mt-1">
                        {targetAudience.length}/400
                      </p>
                    </div>

                    {/* Brand Brief */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Brand Brief{" "}
                          <span className="normal-case font-normal text-gray-400">— optional</span>
                        </label>
                        <AiGenerateBtn
                          generating={briefGenerating}
                          generated={briefGenerated}
                          onClick={() => handleGenerateField("brandBrief")}
                        />
                      </div>
                      <textarea
                        value={brandBrief}
                        onChange={(e) => setBrandBrief(e.target.value.slice(0, 500))}
                        rows={4}
                        maxLength={500}
                        placeholder="What does your brand do, sell, or stand for? e.g. We make sustainable activewear for women who want to look good and do good."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#1A2E44] placeholder:text-gray-300 resize-none outline-none focus:border-[#1A7A4A] focus:bg-white transition-colors leading-relaxed"
                      />
                      <p className="text-right text-[11px] text-gray-300 mt-1">
                        {brandBrief.length}/500
                      </p>
                    </div>
                  </div>

                  {apiError && (
                    <p className="mt-5 text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center max-w-lg mx-auto">
                      {apiError}
                    </p>
                  )}

                  <ContinueBtn
                    label="Complete Setup"
                    disabled={targetAudience.trim().length < 10}
                    loading={isSubmitting}
                    onClick={handleSubmit}
                  />
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
