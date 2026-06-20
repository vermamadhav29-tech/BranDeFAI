"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Download,
  FileText,
  Sparkles,
  Loader2,
  Trash2,
  Clock,
  Copy,
  Check,
  Edit2,
  Users,
  Film,
  Music,
} from "lucide-react";
import { useCalendarStore } from "@/stores/calendarStore";
import type { CalendarEntry, ContentType } from "@/stores/calendarStore";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CalendarDaySkeleton } from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const TYPE_CONFIG: Record<
  ContentType,
  { label: string; color: string; bg: string; accent: string }
> = {
  CAPTION:   { label: "Caption",  color: "#1A7A4A", bg: "#E8F5EE", accent: "#1A7A4A" },
  REEL_IDEA: { label: "Reel",     color: "#2563EB", bg: "#EFF6FF", accent: "#2563EB" },
  AD_COPY:   { label: "Ad Copy",  color: "#D97706", bg: "#FFFBEB", accent: "#D97706" },
  IMAGE:     { label: "Image",    color: "#7C3AED", bg: "#F5F3FF", accent: "#7C3AED" },
  VIDEO:     { label: "Video",    color: "#0891B2", bg: "#E0F7FA", accent: "#0891B2" },
};

const gridVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.28, ease: EASE_OUT } },
  exit: (dir: number) => ({
    x: dir > 0 ? -48 : 48, opacity: 0,
    transition: { duration: 0.18, ease: EASE_OUT },
  }),
};

// ─── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (target === 0) { setCount(0); return; }
    let startTime: number | null = null;
    function tick(now: number) {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

// ─── Local types ───────────────────────────────────────────────────────────────

interface RawContent {
  id: string;
  captions: string[];
  reelIdeas: Array<{
    hook: string;
    shotList: string[];
    audioType?: string;
    duration?: string;
    caption?: string;
  }>;
  adCopy: { headline: string; body: string; cta: string } | null;
  calendarAssigned: boolean;
}

interface RawImage {
  id: string;
  imageUrl: string;
  style: string;
  format: string;
  calendarAssigned: boolean;
}

interface AssignableItem {
  key: string;
  contentType: ContentType;
  contentId: string;
  preview: string;
  imageUrl?: string;
}

type ReelPreview = {
  hook?: string;
  shotList?: string[];
  audioType?: string;
  duration?: string;
  caption?: string;
};

type AdCopyPreview = {
  headline?: string;
  body?: string;
  cta?: string;
  variations?: Array<{
    primaryText?: string;
    headline?: string;
    description?: string;
    cta?: string;
  }>;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Strips the trailing hashtag block from a caption so it can be shown separately.
function parseCaptionBody(text: string): string {
  if (!text) return "";
  const parts = text.split("\n\n");
  const last = parts[parts.length - 1].trim();
  if (/^(#\w+[\s]*)+$/.test(last)) {
    return parts.slice(0, -1).join("\n\n").trim();
  }
  return text.trim();
}

function getPreviewText(entry: CalendarEntry): string {
  const p = entry.preview;
  if (entry.contentType === "CAPTION") return typeof p === "string" ? p : "";
  if (entry.contentType === "REEL_IDEA") return (p as ReelPreview | null)?.hook ?? "";
  if (entry.contentType === "AD_COPY") {
    const a = p as AdCopyPreview | null;
    return a ? [a.headline, a.body].filter(Boolean).join(" — ") : "";
  }
  if (entry.contentType === "VIDEO") return "Video clip";
  return "";
}

function getImageUrl(entry: CalendarEntry): string | null {
  if (entry.contentType === "IMAGE") {
    return (entry.preview as { imageUrl?: string } | null)?.imageUrl ?? null;
  }
  // Show promotional image thumbnail for caption entries too
  if (entry.assetUrl && entry.contentType === "CAPTION") return entry.assetUrl;
  return null;
}

// ─── Small display helpers used inside ContentDetail ──────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

function HashtagsSection({ hashtags }: { hashtags?: string[] | null }) {
  if (!hashtags?.length) return null;
  return (
    <section>
      <SectionLabel>Hashtags</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {hashtags.map((tag) => (
          <span
            key={tag}
            className="text-xs font-semibold bg-[#E8F5EE] text-[#1A7A4A] px-2.5 py-0.5 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}

function KeywordsSection({ keywords }: { keywords?: string[] | null }) {
  if (!keywords?.length) return null;
  return (
    <section>
      <SectionLabel>SEO Keywords</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full"
          >
            {kw}
          </span>
        ))}
      </div>
    </section>
  );
}

function SuggestedTimeRow({ time }: { time?: string | null }) {
  if (!time) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#1A7A4A] font-medium">
      <Clock size={12} className="shrink-0" />
      Best time to post: <span className="font-bold">{time}</span>
    </div>
  );
}

// ─── ContentDetail — rich per-type preview ────────────────────────────────────

function ContentDetail({ entry }: { entry: CalendarEntry }) {
  const p = entry.preview;

  // ── CAPTION ──
  if (entry.contentType === "CAPTION") {
    const fullText = typeof p === "string" ? p : "";
    const bodyText = parseCaptionBody(fullText);
    return (
      <div className="space-y-4">
        {entry.assetUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.assetUrl}
            alt="Promotional visual"
            className="w-full rounded-xl object-cover max-h-52"
          />
        )}
        <section>
          <SectionLabel>Caption</SectionLabel>
          <div className="bg-[#F8FAF9] rounded-xl p-4 border border-[#E8F5EE]">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {bodyText || "No caption text available."}
            </p>
          </div>
        </section>
        <HashtagsSection hashtags={entry.hashtags} />
        <KeywordsSection keywords={entry.keywords} />
        <SuggestedTimeRow time={entry.suggestedTime} />
      </div>
    );
  }

  // ── REEL_IDEA ──
  if (entry.contentType === "REEL_IDEA") {
    const reel = p as ReelPreview | null;
    return (
      <div className="space-y-4">
        {reel?.hook && (
          <section>
            <SectionLabel>Hook (First 3 Seconds)</SectionLabel>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-sm text-gray-800 font-semibold leading-relaxed">
                &ldquo;{reel.hook}&rdquo;
              </p>
            </div>
          </section>
        )}

        {reel?.shotList && reel.shotList.length > 0 && (
          <section>
            <SectionLabel>Scene Breakdown</SectionLabel>
            <div className="space-y-2">
              {reel.shotList.map((shot, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600 leading-snug">{shot}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-2 flex-wrap">
          {reel?.audioType && (
            <span className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-lg font-medium">
              <Music size={11} />
              {reel.audioType}
            </span>
          )}
          {reel?.duration && (
            <span className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium">
              <Film size={11} />
              {reel.duration}
            </span>
          )}
        </div>

        {reel?.caption && (
          <section>
            <SectionLabel>Caption for Reel Post</SectionLabel>
            <div className="bg-[#F8FAF9] rounded-xl p-3 border border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {parseCaptionBody(reel.caption)}
              </p>
            </div>
          </section>
        )}

        <HashtagsSection hashtags={entry.hashtags} />
        <KeywordsSection keywords={entry.keywords} />
        <SuggestedTimeRow time={entry.suggestedTime} />
      </div>
    );
  }

  // ── AD_COPY ──
  if (entry.contentType === "AD_COPY") {
    const ad = p as AdCopyPreview | null;
    const variation1 = ad?.variations?.[0];
    const variation2 = ad?.variations?.[1];
    return (
      <div className="space-y-4">
        {ad?.headline && (
          <section>
            <SectionLabel>Headline</SectionLabel>
            <p className="text-xl font-bold text-[#1A2E44] leading-tight">{ad.headline}</p>
          </section>
        )}

        {ad?.body && (
          <section>
            <SectionLabel>Primary Text</SectionLabel>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <p className="text-sm text-gray-700 leading-relaxed">{ad.body}</p>
            </div>
          </section>
        )}

        {variation1?.description && (
          <section>
            <SectionLabel>Description</SectionLabel>
            <p className="text-sm text-gray-600">{variation1.description}</p>
          </section>
        )}

        {ad?.cta && (
          <div>
            <SectionLabel>CTA</SectionLabel>
            <span className="inline-block text-xs font-bold text-white bg-amber-500 px-4 py-1.5 rounded-lg">
              {ad.cta}
            </span>
          </div>
        )}

        {variation2 && (variation2.primaryText || variation2.headline) && (
          <section>
            <SectionLabel>Variation 2 — Urgency</SectionLabel>
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 space-y-1.5">
              {variation2.headline && (
                <p className="text-xs font-bold text-orange-600">{variation2.headline}</p>
              )}
              {variation2.primaryText && (
                <p className="text-sm text-gray-700 leading-relaxed">{variation2.primaryText}</p>
              )}
              {variation2.cta && (
                <span className="inline-block mt-1 text-xs font-bold text-white bg-orange-500 px-3 py-1 rounded-lg">
                  {variation2.cta}
                </span>
              )}
            </div>
          </section>
        )}

        {entry.notes && (
          <section>
            <SectionLabel>Suggested Boost Audience</SectionLabel>
            <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <Users size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <span>{entry.notes}</span>
            </div>
          </section>
        )}

        <KeywordsSection keywords={entry.keywords} />
        <SuggestedTimeRow time={entry.suggestedTime} />
      </div>
    );
  }

  // ── IMAGE ──
  if (entry.contentType === "IMAGE") {
    const img = p as { imageUrl?: string; style?: string; format?: string } | null;
    return (
      <div className="space-y-4">
        {img?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.imageUrl}
            alt="Generated"
            className="w-full rounded-xl object-cover max-h-72"
          />
        )}
        <div className="flex gap-2 flex-wrap">
          {img?.style && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {img.style}
            </span>
          )}
          {img?.format && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {img.format}
            </span>
          )}
        </div>
        <KeywordsSection keywords={entry.keywords} />
        <SuggestedTimeRow time={entry.suggestedTime} />
      </div>
    );
  }

  return null;
}

// ─── DayCell ───────────────────────────────────────────────────────────────────

function DayCell({
  day,
  entry,
  isNew,
  isToday,
  igScheduledAt,
  onClickFilled,
  onClickEmpty,
}: {
  day: number;
  entry: CalendarEntry | undefined;
  isNew: boolean;
  isToday: boolean;
  igScheduledAt?: string;
  onClickFilled: (entry: CalendarEntry) => void;
  onClickEmpty: (day: number) => void;
}) {
  const cfg = entry ? TYPE_CONFIG[entry.contentType] : null;
  const previewText = entry ? getPreviewText(entry) : "";
  const imageUrl = entry ? getImageUrl(entry) : null;
  const isFreshFill = isNew && entry !== undefined;

  return (
    <motion.div
      initial={isFreshFill ? { opacity: 0, scale: 0.8 } : { opacity: 0, scale: 0.97 }}
      animate={
        isFreshFill ? { opacity: 1, scale: [0.8, 1.05, 1] } : { opacity: 1, scale: 1 }
      }
      transition={
        isFreshFill
          ? { duration: 0.35, times: [0, 0.6, 1], ease: "easeOut" }
          : { duration: 0.18, delay: (day - 1) * 0.007, ease: EASE_OUT }
      }
      onClick={() => (entry ? onClickFilled(entry) : onClickEmpty(day))}
      className={cn(
        "relative rounded-xl min-h-[110px] p-2.5 cursor-pointer select-none overflow-hidden transition-shadow duration-200 group",
        entry
          ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.07)] hover:shadow-[0_4px_18px_rgba(0,0,0,0.11)]"
          : [
              "bg-white border border-dashed border-[#E5E7EB]",
              "shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)]",
              "hover:border-[#D1D5DB]",
            ].join(" ")
      )}
    >
      {entry && cfg && (
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
          style={{ backgroundColor: cfg.accent }}
        />
      )}

      <div className="flex items-center gap-1.5 mt-0.5">
        {isToday ? (
          <span className="flex items-center justify-center w-[19px] h-[19px] text-[10px] font-bold text-[#1A7A4A] ring-2 ring-[#1A7A4A] rounded-full leading-none shrink-0">
            {day}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-gray-300 leading-none">{day}</span>
        )}
        {isToday && (
          <span className="text-[8px] font-bold text-[#1A7A4A] uppercase tracking-wide">Today</span>
        )}
      </div>

      {entry && cfg ? (
        <div className="mt-1.5 space-y-1.5">
          <Badge
            size="sm"
            className="font-bold leading-tight"
            style={{ color: cfg.color, backgroundColor: cfg.bg } as React.CSSProperties}
          >
            {cfg.label}
          </Badge>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-14 object-cover rounded-lg" />
          ) : previewText ? (
            <p className="text-[11px] text-gray-600 leading-snug line-clamp-4">{previewText}</p>
          ) : null}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Plus size={15} className="text-gray-400" />
          <span className="text-[10px] text-gray-400">Add Content</span>
        </div>
      )}

      {igScheduledAt && (
        <div
          className="absolute bottom-1.5 right-1.5 group/ig"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-[18px] h-[18px] rounded-md bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-sm">
            <span className="text-white text-[5px] font-black leading-none">IG</span>
          </div>
          <div className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover/ig:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
            <span className="text-gray-400 block mb-0.5">Scheduled for Instagram</span>
            {new Date(igScheduledAt).toLocaleString("en-US", {
              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── DayDetailModal ────────────────────────────────────────────────────────────

function DayDetailModal({
  entry,
  onClose,
  onRemoved,
  onIgScheduled,
}: {
  entry: CalendarEntry;
  onClose: () => void;
  onRemoved: (id: string) => void;
  onIgScheduled: (entryId: string, scheduledAt: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(entry.year, entry.month - 1, entry.calendarDay, 9, 0);
    return d.toISOString().slice(0, 16);
  });

  const cfg = TYPE_CONFIG[entry.contentType];
  const canCopyForInstagram =
    entry.contentType === "CAPTION" || entry.contentType === "REEL_IDEA";

  async function handleRemove() {
    setRemoving(true);
    try {
      await apiClient.delete(`/api/calendar/entry/${entry.id}`);
      onRemoved(entry.id);
      toast.success("Removed from calendar");
    } catch {
      toast.error("Failed to remove entry");
      setRemoving(false);
    }
  }

  async function handleScheduleInstagram() {
    setScheduling(true);
    try {
      const iso = new Date(scheduledAt).toISOString();
      await apiClient.post("/api/instagram/schedule", {
        calendarEntryId: entry.id,
        scheduledAt: iso,
      });
      onIgScheduled(entry.id, iso);
      toast.success("Scheduled for Instagram");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(
        "Scheduling failed",
        e.response?.data?.error ?? "Check your Instagram connection"
      );
    } finally {
      setScheduling(false);
    }
  }

  async function handleCopyForInstagram() {
    let text = "";
    if (entry.contentType === "CAPTION") {
      const body = parseCaptionBody(typeof entry.preview === "string" ? entry.preview : "");
      const tags = (entry.hashtags ?? []).join(" ");
      text = tags ? `${body}\n\n${tags}` : body;
    } else if (entry.contentType === "REEL_IDEA") {
      const reel = entry.preview as ReelPreview | null;
      const caption = reel?.caption ?? "";
      const body = parseCaptionBody(caption);
      const tags = (entry.hashtags ?? []).join(" ");
      text = tags ? `${body}\n\n${tags}` : body;
    }
    if (!text) { toast.error("No caption text to copy"); return; }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not access clipboard");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <Badge
              size="sm"
              className="font-bold"
              style={{ color: cfg.color, backgroundColor: cfg.bg } as React.CSSProperties}
            >
              {cfg.label}
            </Badge>
            <span className="text-sm font-bold text-[#1A2E44]">Day {entry.calendarDay}</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                entry.status === "PUBLISHED"
                  ? "bg-green-50 text-green-600"
                  : entry.status === "SKIPPED"
                  ? "bg-gray-100 text-gray-500"
                  : "bg-blue-50 text-blue-600"
              )}
            >
              {entry.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
          <ContentDetail entry={entry} />

          {/* Instagram scheduling */}
          <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 shrink-0" />
              <p className="text-xs font-semibold text-[#1A2E44]">Schedule for Instagram</p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Clock
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/20 focus:border-[#1A7A4A] bg-white"
                />
              </div>
              <button
                type="button"
                disabled={scheduling}
                onClick={handleScheduleInstagram}
                className="px-3 py-1.5 bg-[#1A7A4A] text-white text-xs font-bold rounded-lg hover:bg-[#145C38] transition-colors disabled:opacity-60 flex items-center gap-1.5 shrink-0"
              >
                {scheduling && <Loader2 size={11} className="animate-spin" />}
                Schedule Post
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={removing}
              onClick={handleRemove}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {removing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Remove
            </button>
            <button
              type="button"
              onClick={() => toast.success("Content editing coming soon")}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Edit2 size={11} />
              Edit
            </button>
          </div>
          <div className="flex items-center gap-2">
            {canCopyForInstagram && (
              <button
                type="button"
                onClick={handleCopyForInstagram}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors",
                  copied
                    ? "bg-[#E8F5EE] text-[#1A7A4A] border border-[#1A7A4A]/40"
                    : "bg-[#1A7A4A] text-white hover:bg-[#145C38]"
                )}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copied!" : "Copy for Instagram"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── AssignModal ───────────────────────────────────────────────────────────────

function AssignModal({
  day,
  month,
  year,
  onClose,
  onAssigned,
}: {
  day: number;
  month: number;
  year: number;
  onClose: () => void;
  onAssigned: (entryId: string) => void;
}) {
  const [items, setItems] = useState<AssignableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    async function loadItems() {
      try {
        const [contentRes, imagesRes] = await Promise.allSettled([
          apiClient.get<{ success: boolean; data: { items: RawContent[] } }>("/api/content"),
          apiClient.get<{ success: boolean; data: { items: RawImage[] } }>("/api/images"),
        ]);

        const flat: AssignableItem[] = [];

        if (contentRes.status === "fulfilled" && contentRes.value.data.success) {
          for (const c of contentRes.value.data.data.items ?? []) {
            if (c.captions?.length > 0) {
              flat.push({
                key: `caption-${c.id}`,
                contentType: "CAPTION",
                contentId: `${c.id}::0`,
                preview: c.captions[0].slice(0, 110),
              });
            }
            if (c.reelIdeas?.length > 0) {
              flat.push({
                key: `reel-${c.id}`,
                contentType: "REEL_IDEA",
                contentId: `${c.id}::0`,
                preview: c.reelIdeas[0].hook.slice(0, 110),
              });
            }
            if (c.adCopy?.headline) {
              flat.push({
                key: `adcopy-${c.id}`,
                contentType: "AD_COPY",
                contentId: c.id,
                preview: c.adCopy.headline.slice(0, 110),
              });
            }
          }
        }

        if (imagesRes.status === "fulfilled" && imagesRes.value.data.success) {
          for (const img of imagesRes.value.data.data.items ?? []) {
            flat.push({
              key: `image-${img.id}`,
              contentType: "IMAGE",
              contentId: img.id,
              preview: `${img.style} · ${img.format}`,
              imageUrl: img.imageUrl,
            });
          }
        }

        setItems(flat);
      } catch {
        toast.error("Failed to load content");
      } finally {
        setLoading(false);
      }
    }
    loadItems();
  }, []);

  async function handleAssign(item: AssignableItem) {
    setAssigning(item.key);
    try {
      const res = await apiClient.post<{ success: boolean; data: CalendarEntry }>(
        "/api/calendar/entry",
        {
          calendarDay: day,
          month,
          year,
          contentType: item.contentType,
          contentId: item.contentId,
        }
      );
      toast.success(`Assigned to Day ${day}`);
      onAssigned(res.data.data.id);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error("Assignment failed", e.response?.data?.error ?? "Please try again");
      setAssigning(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-bold text-[#1A2E44]">Assign Content — Day {day}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 px-6 text-center">
              <p className="text-sm font-semibold text-gray-500">No content available</p>
              <p className="text-xs text-gray-400">Generate captions, images, or ad copy first</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item) => {
                const cfg = TYPE_CONFIG[item.contentType];
                const isAssigning = assigning === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={assigning !== null}
                    onClick={() => handleAssign(item)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap"
                        style={{ color: cfg.color, backgroundColor: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                    )}
                    <p className="text-xs text-gray-700 leading-snug flex-1 line-clamp-2">
                      {item.preview}
                    </p>
                    {isAssigning ? (
                      <Loader2 size={13} className="animate-spin text-[#1A7A4A] shrink-0" />
                    ) : (
                      <Plus size={13} className="text-gray-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── CalendarPage ──────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { entries, month, year, setEntries, setMonth, setYear, removeEntry } =
    useCalendarStore();

  const [loading, setLoading] = useState(true);
  const [filledDays, setFilledDays] = useState(0);
  const [hasUnassigned, setHasUnassigned] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const [assignDay, setAssignDay] = useState<number | null>(null);
  const [direction, setDirection] = useState(1);
  const [newlyFilledIds, setNewlyFilledIds] = useState<Set<string>>(new Set());
  const [igScheduledMap, setIgScheduledMap] = useState<Map<string, string>>(new Map());

  const today = new Date();
  const isCurrentMonth = month === today.getMonth() + 1 && year === today.getFullYear();
  const todayDate = today.getDate();

  const dayMap = new Map(entries.map((e) => [e.calendarDay, e]));
  const displayCount = useCountUp(filledDays);

  const fetchCalendar = useCallback(
    async (m: number, y: number) => {
      setLoading(true);
      try {
        const [calRes, statsRes, contentRes] = await Promise.allSettled([
          apiClient.get<{ success: boolean; data: { entries: CalendarEntry[] } }>(
            `/api/calendar?month=${m}&year=${y}`
          ),
          apiClient.get<{ success: boolean; data: { filledDays: number } }>(
            `/api/calendar/stats?month=${m}&year=${y}`
          ),
          apiClient.get<{
            success: boolean;
            data: { items: Array<{ calendarAssigned: boolean }> };
          }>("/api/content"),
        ]);

        if (calRes.status === "fulfilled" && calRes.value.data.success) {
          setEntries(calRes.value.data.data.entries ?? []);
        }
        if (statsRes.status === "fulfilled" && statsRes.value.data.success) {
          setFilledDays(statsRes.value.data.data.filledDays ?? 0);
        }
        if (contentRes.status === "fulfilled" && contentRes.value.data.success) {
          const items = contentRes.value.data.data.items ?? [];
          setHasUnassigned(items.some((c) => !c.calendarAssigned));
        }
      } catch {
        toast.error("Failed to load calendar");
      } finally {
        setLoading(false);
      }
    },
    [setEntries]
  );

  useEffect(() => {
    fetchCalendar(month, year);
  }, [month, year, fetchCalendar]);

  function prevMonth() {
    setDirection(-1);
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    setDirection(1);
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  function markNewIds(ids: Set<string>) {
    setNewlyFilledIds(ids);
    setTimeout(() => setNewlyFilledIds(new Set()), 1500);
  }

  async function handleAutoAssign() {
    setAutoAssigning(true);
    try {
      const contentRes = await apiClient.get<{
        success: boolean;
        data: { items: Array<{ id: string; calendarAssigned: boolean }> };
      }>("/api/content");
      const unassigned = (contentRes.data.data.items ?? []).filter((c) => !c.calendarAssigned);

      if (unassigned.length === 0) {
        toast.error("No unassigned content", "Generate content first.");
        return;
      }

      const res = await apiClient.post<{
        success: boolean;
        data: { entries: CalendarEntry[]; count: number };
      }>("/api/calendar/auto-assign", { contentBatchId: unassigned[0].id });

      if (res.data.success) {
        const ids = new Set((res.data.data.entries ?? []).map((e) => e.id));
        markNewIds(ids);
        toast.success(`Auto-assigned ${res.data.data.count} items to your calendar`);
        await fetchCalendar(month, year);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error("Auto-assign failed", e.response?.data?.error ?? "Please try again");
    } finally {
      setAutoAssigning(false);
    }
  }

  async function handleExport(type: "pdf" | "csv") {
    try {
      const res = await apiClient.get(
        `/api/calendar/export/${type}?month=${month}&year=${year}`,
        { responseType: "blob" }
      );
      const blob = new Blob([res.data as BlobPart], {
        type: type === "pdf" ? "application/pdf" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calendar-${MONTH_NAMES[month - 1]}-${year}.${type}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Failed to export ${type.toUpperCase()}`);
    }
  }

  const progressPct = Math.round((filledDays / 30) * 100);

  return (
    <div className="pb-8">
      {/* ── Top section: progress + export ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Monthly Progress
          </p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-[280px] h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1, ease: EASE_OUT }}
                style={{ background: "linear-gradient(90deg, #1A7A4A 0%, #34D399 100%)" }}
                className="absolute inset-y-0 left-0 rounded-full"
              />
            </div>
            <span className="text-sm font-bold text-[#1A2E44] shrink-0 tabular-nums">
              <span className="text-[#1A7A4A]">{displayCount}</span>
              <span className="text-gray-400 font-normal"> / 30 days</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={13} />
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            onClick={prevMonth}
            whileTap={{ x: -3, scale: 0.92 }}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </motion.button>

          <div className="min-w-[160px] text-center">
            <AnimatePresence mode="wait">
              <motion.h2
                key={`${month}-${year}-label`}
                initial={{ opacity: 0, x: direction > 0 ? 16 : -16 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } }}
                exit={{ opacity: 0, x: direction > 0 ? -16 : 16, transition: { duration: 0.14, ease: EASE_OUT } }}
                className="text-2xl font-bold text-[#1A2E44] leading-none"
              >
                {MONTH_NAMES[month - 1]}{" "}
                <span className="text-gray-300 font-medium">{year}</span>
              </motion.h2>
            </AnimatePresence>
          </div>

          <motion.button
            type="button"
            onClick={nextMonth}
            whileTap={{ x: 3, scale: 0.92 }}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </motion.button>
        </div>

        <AnimatePresence>
          {hasUnassigned && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              type="button"
              disabled={autoAssigning}
              onClick={handleAutoAssign}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1A7A4A] text-white text-xs font-bold rounded-xl hover:bg-[#145C38] transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-green-900/10"
            >
              {autoAssigning ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              Auto-Assign Content
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── 5×6 Calendar grid ── */}
      <div className="overflow-hidden">
        {loading ? (
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 30 }).map((_, i) => (
              <CalendarDaySkeleton key={i} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${month}-${year}`}
              custom={direction}
              variants={gridVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="grid grid-cols-6 gap-2"
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                const entry = dayMap.get(day);
                return (
                  <DayCell
                    key={`${day}-${entry?.id ?? "empty"}`}
                    day={day}
                    entry={entry}
                    isNew={newlyFilledIds.has(entry?.id ?? "")}
                    isToday={isCurrentMonth && day === todayDate}
                    igScheduledAt={entry ? igScheduledMap.get(entry.id) : undefined}
                    onClickFilled={setSelectedEntry}
                    onClickEmpty={setAssignDay}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {selectedEntry && (
          <DayDetailModal
            key="detail"
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            onRemoved={(id) => {
              removeEntry(id);
              setFilledDays((n) => Math.max(0, n - 1));
              setSelectedEntry(null);
            }}
            onIgScheduled={(entryId, scheduledAt) => {
              setIgScheduledMap((m) => new Map(m).set(entryId, scheduledAt));
            }}
          />
        )}
        {assignDay !== null && (
          <AssignModal
            key="assign"
            day={assignDay}
            month={month}
            year={year}
            onClose={() => setAssignDay(null)}
            onAssigned={(entryId) => {
              markNewIds(new Set([entryId]));
              setAssignDay(null);
              fetchCalendar(month, year);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
