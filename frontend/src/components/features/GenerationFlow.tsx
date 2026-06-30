"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Loader2,
  Copy,
  RefreshCw,
  Download,
  CalendarPlus,
  Pencil,
  Save,
  X,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AdCopy {
  headline: string;
  body: string;
  cta: string;
}

interface ReelIdea {
  hook: string;
  shotList: string[];
}

interface ContentResult {
  contentId: string;
  captions: string[];
  adCopy: AdCopy;
  reelIdeas: ReelIdea[];
  images: (string | null)[];
}

interface ApiData<T> {
  success: boolean;
  data: T;
  error: string | null;
}

interface CaptionVariant {
  type: "emotional" | "offer_driven" | "festival_occasion";
  hook: string;
  body: string;
  cta: string;
  full_caption: string;
  hashtags: string[];
}

interface CaptionResponse {
  caption: CaptionVariant;
  hasMoreAlternates: boolean;
}

export interface GenerationFlowProps {
  productImageId: string;
  onReset: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const STEPS = [
  "Analyzing product image",
  "Writing captions & ad copy",
  "Generating visual assets",
  "Assembling your content pack",
] as const;

// ─── Toast ───────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1A2E44] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2.5"
        >
          <CheckCircle2 size={16} className="text-[#34D399] shrink-0" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────────

function ProgressStep({
  label,
  state,
  isLast,
}: {
  label: string;
  state: "pending" | "active" | "done";
  isLast: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 w-full max-w-xs">
        {/* Circle */}
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-500",
            state === "done" && "bg-[#1A7A4A]",
            state === "active" && "bg-[#1A7A4A]/10 border-2 border-[#1A7A4A]",
            state === "pending" && "bg-gray-100 border-2 border-gray-200"
          )}
        >
          {state === "done" && <Check size={14} className="text-white" strokeWidth={2.5} />}
          {state === "active" && (
            <Loader2 size={14} className="text-[#1A7A4A] animate-spin" />
          )}
          {state === "pending" && (
            <span className="text-xs text-gray-400 font-semibold">
              {STEPS.indexOf(label as typeof STEPS[number]) + 1}
            </span>
          )}
        </div>

        {/* Label */}
        <span
          className={cn(
            "text-sm font-medium transition-colors duration-300",
            state === "done" && "text-[#1A7A4A]",
            state === "active" && "text-[#1A2E44]",
            state === "pending" && "text-gray-300"
          )}
        >
          {label}
        </span>
      </div>

      {/* Connector line */}
      {!isLast && (
        <div className="w-0.5 h-6 my-1 ml-[-calc(50%-1rem)] relative overflow-hidden">
          <div className={cn("absolute inset-0 transition-colors duration-500",
            state === "done" ? "bg-[#1A7A4A]" : "bg-gray-200"
          )} />
        </div>
      )}
    </div>
  );
}

// ─── Generating view ──────────────────────────────────────────────────────────────

function GeneratingView({ activeStep }: { activeStep: number }) {
  function stepState(i: number): "pending" | "active" | "done" {
    if (i < activeStep) return "done";
    if (i === activeStep) return "active";
    return "pending";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="bg-white border border-gray-100 rounded-2xl shadow-sm p-10 flex flex-col items-center"
    >
      {/* Sparkle icon */}
      <motion.div
        animate={{ rotate: [0, 15, -10, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="w-14 h-14 rounded-2xl bg-[#E8F5EE] flex items-center justify-center mb-8"
      >
        <Sparkles size={26} className="text-[#1A7A4A]" />
      </motion.div>

      <h2 className="text-xl font-bold text-[#1A2E44] mb-1">Generating Your Content Pack</h2>
      <p className="text-sm text-gray-400 mb-8">This usually takes 30–60 seconds</p>

      {/* Steps */}
      <div className="w-full max-w-xs">
        {STEPS.map((step, i) => (
          <ProgressStep
            key={step}
            label={step}
            state={stepState(i)}
            isLast={i === STEPS.length - 1}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Caption card ─────────────────────────────────────────────────────────────────

function CaptionCard({
  text,
  index,
  isLoading,
  onRegenerate,
}: {
  text: string;
  index: number;
  isLoading: boolean;
  onRegenerate: (i: number) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col min-h-[140px] relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl z-10">
          <Loader2 size={20} className="text-[#1A7A4A] animate-spin" />
        </div>
      )}
      <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-3">{text}</p>
      <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
            copied
              ? "bg-[#E8F5EE] text-[#1A7A4A]"
              : "bg-gray-50 text-gray-500 hover:bg-gray-100"
          )}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => onRegenerate(index)}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors ml-auto disabled:opacity-40"
        >
          <RefreshCw size={12} />
          Regenerate
          <span className="text-gray-400">2cr</span>
        </button>
      </div>
    </div>
  );
}

// ─── Ad copy card ─────────────────────────────────────────────────────────────────

function AdCopyCard({
  adCopy,
  isLoading,
  onRegenerate,
  onUpdate,
}: {
  adCopy: AdCopy;
  isLoading: boolean;
  onRegenerate: () => void;
  onUpdate: (updated: AdCopy) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AdCopy>(adCopy);

  function handleEdit() {
    setDraft(adCopy);
    setEditing(true);
  }

  function handleSave() {
    onUpdate(draft);
    setEditing(false);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl z-10">
          <Loader2 size={20} className="text-[#1A7A4A] animate-spin" />
        </div>
      )}

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Headline</label>
            <input
              type="text"
              value={draft.headline}
              onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1A2E44] font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Body</label>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              rows={3}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/30 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">CTA</label>
            <input
              type="text"
              value={draft.cta}
              onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1A7A4A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/30"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-[#1A7A4A] text-white hover:bg-[#145C38] transition-colors"
            >
              <Save size={12} />
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xl font-bold text-[#1A2E44] mb-2 leading-snug">{adCopy.headline}</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">{adCopy.body}</p>
          <span className="inline-block bg-[#E8F5EE] text-[#1A7A4A] text-xs font-bold px-3 py-1.5 rounded-full">
            {adCopy.cta}
          </span>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50">
            <button
              type="button"
              onClick={handleEdit}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors ml-auto disabled:opacity-40"
            >
              <RefreshCw size={12} />
              Regenerate
              <span className="text-gray-400">2cr</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Reel card ─────────────────────────────────────────────────────────────────────

function ReelCard({ idea }: { idea: ReelIdea }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <p className="text-[#1A7A4A] font-bold text-sm leading-snug mb-4 pl-3 border-l-2 border-[#1A7A4A]">
        &ldquo;{idea.hook}&rdquo;
      </p>
      <ol className="space-y-2">
        {idea.shotList.map((shot, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-600">
            <span className="shrink-0 text-base leading-tight">🎥</span>
            <span className="leading-snug">
              <span className="font-semibold text-gray-400 mr-1">{i + 1}.</span>
              {shot}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Image card ──────────────────────────────────────────────────────────────────

function ImageCard({
  url,
  index,
  contentId,
  onToast,
}: {
  url: string | null;
  index: number;
  contentId: string;
  onToast: (msg: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [addedToCalendar, setAddedToCalendar] = useState(false);

  async function handleDownload() {
    if (!url) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `brandefai-image-${index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }

  async function handleAddToCalendar() {
    try {
      await apiClient.post("/api/calendar/auto-assign", { contentId });
      setAddedToCalendar(true);
      onToast("Image added to your content calendar!");
    } catch {
      onToast("Could not add to calendar. Try 'Save All' below.");
    }
  }

  if (!url) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
          <X size={20} className="text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">Generation failed</p>
          <p className="text-xs text-gray-400 mt-0.5">Retry with your next content batch</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Generated image ${index + 1}`}
        className="w-full aspect-square object-cover"
        loading="lazy"
      />
      <div className="flex gap-2 p-3 border-t border-gray-50">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Download
        </button>
        <button
          type="button"
          onClick={handleAddToCalendar}
          disabled={addedToCalendar}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors",
            addedToCalendar
              ? "bg-[#E8F5EE] text-[#1A7A4A]"
              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
          )}
        >
          {addedToCalendar ? <Check size={12} /> : <CalendarPlus size={12} />}
          {addedToCalendar ? "Added!" : "Add to Calendar"}
        </button>
      </div>
    </div>
  );
}

// ─── Error view ──────────────────────────────────────────────────────────────────

function ErrorView({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="bg-white border border-red-100 rounded-2xl shadow-sm p-10 flex flex-col items-center text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
        <X size={26} className="text-red-500" />
      </div>
      <h2 className="text-lg font-bold text-[#1A2E44] mb-1">Generation Failed</h2>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-2 bg-[#1A7A4A] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#145C38] transition-colors"
      >
        <RefreshCw size={14} />
        Try Again
      </button>
    </motion.div>
  );
}

// ─── GenerationFlow ───────────────────────────────────────────────────────────────

export function GenerationFlow({ productImageId, onReset }: GenerationFlowProps) {
  type FlowState = "generating" | "results" | "error";

  const user = useAuthStore((s) => s.user);
  const updateCredits = useAuthStore((s) => s.updateCredits);

  const [flowState, setFlowState] = useState<FlowState>("generating");
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<ContentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mutable results state
  const [captions, setCaptions] = useState<string[]>([]);
  const [captionLoading, setCaptionLoading] = useState<Set<number>>(new Set());
  const [hasMoreAlternates, setHasMoreAlternates] = useState(false);
  const [alternateLoading, setAlternateLoading] = useState(false);
  const [adCopy, setAdCopy] = useState<AdCopy | null>(null);
  const [adCopyLoading, setAdCopyLoading] = useState(false);

  // Calendar
  const [calendarSaved, setCalendarSaved] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
  }

  // Step timer (visual-only, spreads across the expected 30-60s generation window)
  useEffect(() => {
    if (flowState !== "generating") return;
    const timers = [
      setTimeout(() => setActiveStep(1), 10_000),
      setTimeout(() => setActiveStep(2), 25_000),
      setTimeout(() => setActiveStep(3), 45_000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [flowState]);

  // Generation API call
  useEffect(() => {
    let cancelled = false;

    apiClient
      .post<ApiData<ContentResult>>("/api/content/generate", { productImageId })
      .then((res) => {
        if (cancelled) return;
        if (res.data.success && res.data.data) {
          const data = res.data.data;
          setResult(data);
          setCaptions(data.captions as string[]);
          setAdCopy(data.adCopy as AdCopy);
          if (user) updateCredits(Math.max(0, user.creditsBalance - 20));
          setFlowState("results");
        } else {
          setErrorMsg(res.data.error ?? "Generation failed. Please try again.");
          setFlowState("error");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        setErrorMsg(e.response?.data?.error ?? e.message ?? "Generation failed. Please try again.");
        setFlowState("error");
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productImageId]);

  const handleRegenerateCaption = useCallback(
    async (idx: number) => {
      if (!result) return;
      setCaptionLoading((prev) => new Set([...prev, idx]));
      try {
        const res = await apiClient.post<ApiData<CaptionResponse>>(
          `/api/content/${result.contentId}/regenerate-caption`
        );
        if (res.data.success && res.data.data?.caption) {
          setCaptions([res.data.data.caption.full_caption]);
          setHasMoreAlternates(res.data.data.hasMoreAlternates);
          if (user) updateCredits(Math.max(0, user.creditsBalance - 2));
        }
      } catch {
        showToast("Regeneration failed. Please try again.");
      } finally {
        setCaptionLoading((prev) => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }
    },
    [result, user, updateCredits]
  );

  const handleShowAnotherCaption = useCallback(async () => {
    if (!result) return;
    setAlternateLoading(true);
    try {
      const res = await apiClient.post<ApiData<CaptionResponse>>(
        `/api/content/${result.contentId}/caption/next-alternate`
      );
      if (res.data.success && res.data.data?.caption) {
        setCaptions([res.data.data.caption.full_caption]);
        setHasMoreAlternates(res.data.data.hasMoreAlternates);
      }
    } catch {
      showToast("No more alternate versions. Try Regenerate for fresh captions.");
      setHasMoreAlternates(false);
    } finally {
      setAlternateLoading(false);
    }
  }, [result]);

  const handleRegenerateAdCopy = useCallback(async () => {
    if (!result) return;
    setAdCopyLoading(true);
    try {
      const res = await apiClient.post<ApiData<{ adCopy: AdCopy }>>(
        `/api/content/${result.contentId}/regenerate-adcopy`
      );
      if (res.data.success && res.data.data?.adCopy) {
        setAdCopy(res.data.data.adCopy);
        if (user) updateCredits(Math.max(0, user.creditsBalance - 2));
      }
    } catch {
      showToast("Regeneration failed. Please try again.");
    } finally {
      setAdCopyLoading(false);
    }
  }, [result, user, updateCredits]);

  const handleSaveAllToCalendar = useCallback(async () => {
    if (!result || calendarSaved || calendarLoading) return;
    setCalendarLoading(true);
    try {
      await apiClient.post("/api/calendar/auto-assign", { contentId: result.contentId });
      setCalendarSaved(true);
      showToast("Added to your content calendar!");
    } catch {
      showToast("Could not save to calendar. Please try again.");
    } finally {
      setCalendarLoading(false);
    }
  }, [result, calendarSaved, calendarLoading]);

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <>
      <Toast message={toastMsg} visible={toastVisible} />

      <AnimatePresence mode="wait">
        {flowState === "generating" && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GeneratingView activeStep={activeStep} />
          </motion.div>
        )}

        {flowState === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorView message={errorMsg ?? "Something went wrong."} onReset={onReset} />
          </motion.div>
        )}

        {flowState === "results" && result && adCopy && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="space-y-6"
          >
            {/* ── Results header ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-[#1A2E44]">✨ Your Content Pack is Ready</h2>
                <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
                  20 credits used
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  Generate New
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllToCalendar}
                  disabled={calendarSaved || calendarLoading}
                  className={cn(
                    "flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors",
                    calendarSaved
                      ? "bg-[#E8F5EE] text-[#1A7A4A]"
                      : "bg-[#1A7A4A] text-white hover:bg-[#145C38]",
                    calendarLoading && "opacity-70"
                  )}
                >
                  {calendarLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : calendarSaved ? (
                    <Check size={14} />
                  ) : (
                    <CalendarPlus size={14} />
                  )}
                  {calendarSaved ? "Saved to Calendar" : "Save All to Calendar"}
                </button>
              </div>
            </div>

            {/* ── Captions ─────────────────────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Instagram Captions
                <span className="normal-case font-normal ml-1 text-gray-300">
                  {captions.length > 1 ? "— choose your favourite or use all 3" : "— AI's top pick for this post"}
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {captions.map((caption, i) => (
                  <CaptionCard
                    key={i}
                    text={caption}
                    index={i}
                    isLoading={captionLoading.has(i)}
                    onRegenerate={handleRegenerateCaption}
                  />
                ))}
              </div>
              {captions.length === 1 && hasMoreAlternates && (
                <button
                  type="button"
                  onClick={handleShowAnotherCaption}
                  disabled={alternateLoading}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors mt-3 disabled:opacity-40"
                >
                  {alternateLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Show me another
                  <span className="text-gray-400">free</span>
                </button>
              )}
            </section>

            {/* ── Ad Copy ──────────────────────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ad Copy</p>
              <AdCopyCard
                adCopy={adCopy}
                isLoading={adCopyLoading}
                onRegenerate={handleRegenerateAdCopy}
                onUpdate={setAdCopy}
              />
            </section>

            {/* ── Reel Ideas ───────────────────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Reel Ideas
                <span className="normal-case font-normal ml-1 text-gray-300">— full shot-by-shot breakdown</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(result.reelIdeas as ReelIdea[]).map((idea, i) => (
                  <ReelCard key={i} idea={idea} />
                ))}
              </div>
            </section>

            {/* ── Generated Images ─────────────────────────────────────────── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                AI-Generated Visuals
              </p>
              <div className="grid grid-cols-2 gap-4">
                {(result.images as (string | null)[]).map((url, i) => (
                  <ImageCard
                    key={i}
                    url={url}
                    index={i}
                    contentId={result.contentId}
                    onToast={showToast}
                  />
                ))}
              </div>
            </section>

            {/* ── Sticky bottom bar ─────────────────────────────────────────── */}
            <div className="sticky bottom-0 z-20 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {calendarSaved ? (
                  <span className="flex items-center gap-2 text-sm text-[#1A7A4A] font-medium">
                    <CheckCircle2 size={16} />
                    Saved to calendar!
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Ready to schedule your content?</span>
                )}
                {calendarSaved && (
                  <Link
                    href="/calendar"
                    className="flex items-center gap-1.5 text-sm font-semibold text-[#1A7A4A] hover:underline"
                  >
                    View Calendar
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>

              {!calendarSaved && (
                <button
                  type="button"
                  onClick={handleSaveAllToCalendar}
                  disabled={calendarLoading}
                  className="flex items-center gap-2 bg-[#1A7A4A] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#145C38] transition-colors disabled:opacity-70"
                >
                  {calendarLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CalendarPlus size={14} />
                  )}
                  Save All to Calendar
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default GenerationFlow;
