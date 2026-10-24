"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
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
  Users,
  Film,
  Music,
  CalendarDays,
} from "lucide-react";
import { useCalendarStore } from "@/stores/calendarStore";
import type { CalendarEntry, ContentType } from "@/stores/calendarStore";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_CONFIG: Record<ContentType, { label: string; color: string; bg: string }> = {
  CAPTION: { label: "Caption", color: "#5235ef", bg: "#ebe8fd" },
  REEL_IDEA: { label: "Reel", color: "#2f6bff", bg: "#e4ecff" },
  AD_COPY: { label: "Ad copy", color: "#12744e", bg: "#e6f6ee" },
  IMAGE: { label: "Image", color: "#b4491a", bg: "#ffeadf" },
  VIDEO: { label: "Video", color: "#b3226b", bg: "#fde7f1" },
};

// ─── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 800): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (target === 0) { setCount(0); return; }
    let startTime: number | null = null;
    function tick(now: number) {
      if (!startTime) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      setCount(Math.round(target * (1 - Math.pow(1 - progress, 3))));
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
  reelIdeas: Array<{ hook: string; shotList: string[]; audioType?: string; duration?: string; caption?: string }>;
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

type ReelPreview = { hook?: string; shotList?: string[]; audioType?: string; duration?: string; caption?: string };

type AdCopyPreview = {
  headline?: string;
  body?: string;
  cta?: string;
  variations?: Array<{ primaryText?: string; headline?: string; description?: string; cta?: string }>;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Strips the trailing hashtag block from a caption so it can be shown separately.
function parseCaptionBody(text: string): string {
  if (!text) return "";
  const parts = text.split("\n\n");
  const last = parts[parts.length - 1].trim();
  if (/^(#\w+[\s]*)+$/.test(last)) return parts.slice(0, -1).join("\n\n").trim();
  return text.trim();
}

function getPreviewText(entry: CalendarEntry): string {
  const p = entry.preview;
  if (entry.contentType === "CAPTION") return typeof p === "string" ? parseCaptionBody(p) : "";
  if (entry.contentType === "REEL_IDEA") return (p as ReelPreview | null)?.hook ?? "";
  if (entry.contentType === "AD_COPY") {
    const a = p as AdCopyPreview | null;
    return a ? [a.headline, a.body].filter(Boolean).join(" — ") : "";
  }
  if (entry.contentType === "VIDEO") return "Video clip";
  return "";
}

function getImageUrl(entry: CalendarEntry): string | null {
  if (entry.contentType === "IMAGE") return (entry.preview as { imageUrl?: string } | null)?.imageUrl ?? null;
  // Show promotional image thumbnail for caption entries too
  if (entry.assetUrl && entry.contentType === "CAPTION") return entry.assetUrl;
  return null;
}

// ─── Small display helpers used inside ContentDetail ──────────────────────────

function Sec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="bd-sec">
      <div className="lbl">{label}</div>
      {children}
    </section>
  );
}

function HashtagsSection({ hashtags }: { hashtags?: string[] | null }) {
  if (!hashtags?.length) return null;
  return (
    <Sec label="Hashtags">
      <div className="bd-tags">
        {hashtags.map((tag) => <span key={tag} className="bd-chip p">{tag}</span>)}
      </div>
    </Sec>
  );
}

function KeywordsSection({ keywords }: { keywords?: string[] | null }) {
  if (!keywords?.length) return null;
  return (
    <Sec label="SEO keywords">
      <div className="bd-tags">
        {keywords.map((kw) => <span key={kw} className="bd-chip">{kw}</span>)}
      </div>
    </Sec>
  );
}

function SuggestedTimeRow({ time }: { time?: string | null }) {
  if (!time) return null;
  return (
    <div className="bd-chip g" style={{ height: 32, justifySelf: "start" }}>
      <Clock size={13} /> Best time to post: <b>{time}</b>
    </div>
  );
}

// ─── ContentDetail — rich per-type preview ────────────────────────────────────

function ContentDetail({ entry }: { entry: CalendarEntry }) {
  const p = entry.preview;

  if (entry.contentType === "CAPTION") {
    const bodyText = parseCaptionBody(typeof p === "string" ? p : "");
    return (
      <>
        {entry.assetUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.assetUrl} alt="Promotional visual" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 20 }} />
        )}
        <Sec label="Caption"><div className="bd-box">{bodyText || "No caption text available."}</div></Sec>
        <HashtagsSection hashtags={entry.hashtags} />
        <KeywordsSection keywords={entry.keywords} />
        <SuggestedTimeRow time={entry.suggestedTime} />
      </>
    );
  }

  if (entry.contentType === "REEL_IDEA") {
    const reel = p as ReelPreview | null;
    return (
      <>
        {reel?.hook && <Sec label="Hook (first 3 seconds)"><div className="bd-box quote">&ldquo;{reel.hook}&rdquo;</div></Sec>}
        {reel?.shotList && reel.shotList.length > 0 && (
          <Sec label="Scene breakdown">
            <ol className="bd-shots">
              {reel.shotList.map((shot, i) => <li key={i}>{shot}</li>)}
            </ol>
          </Sec>
        )}
        {(reel?.audioType || reel?.duration) && (
          <div className="bd-tags">
            {reel?.audioType && <span className="bd-chip"><Music size={12} /> {reel.audioType}</span>}
            {reel?.duration && <span className="bd-chip"><Film size={12} /> {reel.duration}</span>}
          </div>
        )}
        {reel?.caption && <Sec label="Caption for the reel post"><div className="bd-box">{parseCaptionBody(reel.caption)}</div></Sec>}
        <HashtagsSection hashtags={entry.hashtags} />
        <KeywordsSection keywords={entry.keywords} />
        <SuggestedTimeRow time={entry.suggestedTime} />
      </>
    );
  }

  if (entry.contentType === "AD_COPY") {
    const ad = p as AdCopyPreview | null;
    const variation1 = ad?.variations?.[0];
    const variation2 = ad?.variations?.[1];
    return (
      <>
        {ad?.headline && <Sec label="Headline"><div className="bd-box quote">{ad.headline}</div></Sec>}
        {ad?.body && <Sec label="Primary text"><div className="bd-box">{ad.body}</div></Sec>}
        {variation1?.description && <Sec label="Description"><div className="bd-box">{variation1.description}</div></Sec>}
        {ad?.cta && <Sec label="Call to action"><span className="bd-chip g" style={{ justifySelf: "start" }}>{ad.cta}</span></Sec>}
        {variation2 && (variation2.primaryText || variation2.headline) && (
          <Sec label="Variation 2 — urgency">
            <div className="bd-box">
              {variation2.headline && <b style={{ display: "block", marginBottom: 6, color: "var(--ink)" }}>{variation2.headline}</b>}
              {variation2.primaryText}
              {variation2.cta && <div style={{ marginTop: 8 }}><span className="bd-chip g">{variation2.cta}</span></div>}
            </div>
          </Sec>
        )}
        {entry.notes && (
          <Sec label="Suggested boost audience">
            <div className="bd-box" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Users size={16} style={{ flexShrink: 0, marginTop: 4, color: "var(--p)" }} />
              <span>{entry.notes}</span>
            </div>
          </Sec>
        )}
        <KeywordsSection keywords={entry.keywords} />
        <SuggestedTimeRow time={entry.suggestedTime} />
      </>
    );
  }

  if (entry.contentType === "IMAGE") {
    const img = p as { imageUrl?: string; style?: string; format?: string } | null;
    return (
      <>
        {img?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.imageUrl} alt="Generated" style={{ width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 20, background: "var(--bg)" }} />
        )}
        <div className="bd-tags">
          {img?.style && <span className="bd-chip">{img.style}</span>}
          {img?.format && <span className="bd-chip">{img.format}</span>}
        </div>
        <KeywordsSection keywords={entry.keywords} />
        <SuggestedTimeRow time={entry.suggestedTime} />
      </>
    );
  }

  return null;
}

// ─── DayCell ───────────────────────────────────────────────────────────────────

function DayCell({
  day, weekday, entry, isNew, isToday, isPast, onClickFilled, onClickEmpty,
}: {
  day: number;
  weekday: string;
  entry: CalendarEntry | undefined;
  isNew: boolean;
  isToday: boolean;
  isPast: boolean;
  onClickFilled: (entry: CalendarEntry) => void;
  onClickEmpty: (day: number) => void;
}) {
  const cfg = entry ? TYPE_CONFIG[entry.contentType] : null;
  const previewText = entry ? getPreviewText(entry) : "";
  const imageUrl = entry ? getImageUrl(entry) : null;

  return (
    <button
      type="button"
      className={"bd-cell" + (entry ? " filled" : "") + (isToday ? " is-today" : "") + (isPast ? " is-past" : "") + (isNew ? " is-new" : "")}
      onClick={() => (entry ? onClickFilled(entry) : onClickEmpty(day))}
      aria-label={entry ? `Day ${day}: ${cfg?.label}` : `Day ${day}: empty, add content`}
    >
      {entry && cfg && <span className="bar" style={{ background: cfg.color }} />}
      <div className="dn">
        <span className="wd">{weekday}</span>
        <b>{day}</b>
      </div>
      <div className="content">
        {entry && cfg ? (
          <>
            <span className="tag" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" />
            ) : previewText ? (
              <p className="pv">{previewText}</p>
            ) : null}
          </>
        ) : (
          <span className="add"><Plus size={18} /> Add content</span>
        )}
      </div>
    </button>
  );
}

// ─── DayDetailModal ────────────────────────────────────────────────────────────

function DayDetailModal({ entry, onClose, onRemoved }: { entry: CalendarEntry; onClose: () => void; onRemoved: (id: string) => void }) {
  const [removing, setRemoving] = useState(false);
  const [copied, setCopied] = useState(false);

  const cfg = TYPE_CONFIG[entry.contentType];
  const canCopyForInstagram = entry.contentType === "CAPTION" || entry.contentType === "REEL_IDEA";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  async function handleCopyForInstagram() {
    let text = "";
    if (entry.contentType === "CAPTION") {
      const body = parseCaptionBody(typeof entry.preview === "string" ? entry.preview : "");
      const tags = (entry.hashtags ?? []).join(" ");
      text = tags ? `${body}\n\n${tags}` : body;
    } else if (entry.contentType === "REEL_IDEA") {
      const reel = entry.preview as ReelPreview | null;
      const body = parseCaptionBody(reel?.caption ?? "");
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

  const statusChip = entry.status === "PUBLISHED" ? "g" : entry.status === "SKIPPED" ? "" : "b";

  return (
    <div className="bd-modal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Day ${entry.calendarDay} details`}>
      <div className="bd-modal lg" onClick={(e) => e.stopPropagation()}>
        <div className="bd-modal-hd">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="bd-chip" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
            <h3 style={{ fontSize: 20 }}>{MONTH_NAMES[entry.month - 1]} {entry.calendarDay}</h3>
            <span className={"bd-chip " + statusChip}>{entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}</span>
          </div>
          <button type="button" className="bd-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="bd-modal-bd">
          <ContentDetail entry={entry} />

          <div className="bd-box" style={{ display: "flex", gap: 12, alignItems: "flex-start", whiteSpace: "normal", fontSize: 14 }}>
            <Clock size={18} style={{ flexShrink: 0, marginTop: 2, color: "var(--p)" }} />
            <div>
              <b style={{ display: "block", color: "var(--ink)", marginBottom: 2 }}>Instagram auto-posting is coming soon</b>
              For now, use &ldquo;Copy for Instagram&rdquo; and post it yourself at the suggested time.{" "}
              <Link href="/social-accounts" className="bd-link" style={{ display: "inline" }}>Learn more</Link>
            </div>
          </div>
        </div>

        <div className="bd-modal-ft">
          <button type="button" className="bd-btn bd-btn-sm" style={{ background: "var(--red-bg)", color: "var(--red)" }} disabled={removing} onClick={handleRemove}>
            {removing ? <Loader2 size={14} className="bd-spin-icon" /> : <Trash2 size={14} />} Remove
          </button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canCopyForInstagram && (
              <button type="button" className={"bd-btn bd-btn-sm " + (copied ? "bd-btn-green" : "bd-btn-dark")} onClick={handleCopyForInstagram}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : "Copy for Instagram"}
              </button>
            )}
            <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AssignModal ───────────────────────────────────────────────────────────────

function AssignModal({ day, month, year, onClose, onAssigned }: { day: number; month: number; year: number; onClose: () => void; onAssigned: (entryId: string) => void }) {
  const [items, setItems] = useState<AssignableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
            if (c.captions?.length > 0) flat.push({ key: `caption-${c.id}`, contentType: "CAPTION", contentId: `${c.id}::0`, preview: c.captions[0].slice(0, 110) });
            if (c.reelIdeas?.length > 0) flat.push({ key: `reel-${c.id}`, contentType: "REEL_IDEA", contentId: `${c.id}::0`, preview: c.reelIdeas[0].hook.slice(0, 110) });
            if (c.adCopy?.headline) flat.push({ key: `adcopy-${c.id}`, contentType: "AD_COPY", contentId: c.id, preview: c.adCopy.headline.slice(0, 110) });
          }
        }

        if (imagesRes.status === "fulfilled" && imagesRes.value.data.success) {
          for (const img of imagesRes.value.data.data.items ?? []) {
            flat.push({ key: `image-${img.id}`, contentType: "IMAGE", contentId: img.id, preview: `${img.style} · ${img.format}`, imageUrl: img.imageUrl });
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
      const res = await apiClient.post<{ success: boolean; data: CalendarEntry }>("/api/calendar/entry", {
        calendarDay: day, month, year, contentType: item.contentType, contentId: item.contentId,
      });
      toast.success(`Assigned to ${MONTH_NAMES[month - 1]} ${day}`);
      onAssigned(res.data.data.id);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error("Assignment failed", e.response?.data?.error ?? "Please try again");
      setAssigning(null);
    }
  }

  return (
    <div className="bd-modal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Assign content to day ${day}`}>
      <div className="bd-modal lg" onClick={(e) => e.stopPropagation()}>
        <div className="bd-modal-hd">
          <div>
            <h3 style={{ fontSize: 20 }}>Add content to {MONTH_NAMES[month - 1]} {day}</h3>
            <p className="bd-card-sub" style={{ margin: "2px 0 0" }}>Choose something you&apos;ve already generated.</p>
          </div>
          <button type="button" className="bd-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="bd-modal-bd" style={{ minHeight: 160 }}>
          {loading ? (
            <div style={{ display: "grid", gap: 8 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="bd-skel" style={{ height: 64, borderRadius: 16 }} />)}</div>
          ) : items.length === 0 ? (
            <div className="bd-empty">
              <strong>No content available</strong>
              Generate captions, images or ad copy first.
              <div style={{ marginTop: 12 }}><Link href="/dashboard" className="bd-btn bd-btn-primary bd-btn-sm">Create content</Link></div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {items.map((item) => {
                const cfg = TYPE_CONFIG[item.contentType];
                const isAssigning = assigning === item.key;
                return (
                  <button key={item.key} type="button" className="bd-pick" disabled={assigning !== null} onClick={() => handleAssign(item)}>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" />
                    ) : (
                      <span className="bd-chip" style={{ background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                    )}
                    <p>{item.preview}</p>
                    {isAssigning ? <Loader2 size={16} className="bd-spin-icon" /> : <Plus size={16} style={{ color: "var(--muted)" }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CalendarPage ──────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { entries, month, year, setEntries, setMonth, setYear, removeEntry } = useCalendarStore();

  const [loading, setLoading] = useState(true);
  const [filledDays, setFilledDays] = useState(0);
  const [hasUnassigned, setHasUnassigned] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const [assignDay, setAssignDay] = useState<number | null>(null);
  const [newlyFilledIds, setNewlyFilledIds] = useState<Set<string>>(new Set());

  const today = new Date();
  const isCurrentMonth = month === today.getMonth() + 1 && year === today.getFullYear();
  const todayDate = today.getDate();

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday = 0

  const dayMap = useMemo(() => new Map(entries.map((e) => [e.calendarDay, e])), [entries]);
  const displayCount = useCountUp(filledDays);

  const typeCounts = useMemo(() => {
    const c: Partial<Record<ContentType, number>> = {};
    for (const e of entries) c[e.contentType] = (c[e.contentType] ?? 0) + 1;
    return c;
  }, [entries]);

  const fetchCalendar = useCallback(
    async (m: number, y: number) => {
      setLoading(true);
      try {
        const [calRes, statsRes, contentRes] = await Promise.allSettled([
          apiClient.get<{ success: boolean; data: { entries: CalendarEntry[] } }>(`/api/calendar?month=${m}&year=${y}`),
          apiClient.get<{ success: boolean; data: { filledDays: number } }>(`/api/calendar/stats?month=${m}&year=${y}`),
          apiClient.get<{ success: boolean; data: { items: Array<{ calendarAssigned: boolean }> } }>("/api/content"),
        ]);

        const loaded = calRes.status === "fulfilled" && calRes.value.data.success ? calRes.value.data.data.entries ?? [] : null;
        if (loaded) setEntries(loaded);
        if (statsRes.status === "fulfilled" && statsRes.value.data.success && typeof statsRes.value.data.data.filledDays === "number") {
          setFilledDays(statsRes.value.data.data.filledDays);
        } else if (loaded) {
          setFilledDays(loaded.length);
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
    [setEntries],
  );

  useEffect(() => {
    fetchCalendar(month, year);
  }, [month, year, fetchCalendar]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
  }

  function goToday() {
    setMonth(today.getMonth() + 1);
    setYear(today.getFullYear());
  }

  function markNewIds(ids: Set<string>) {
    setNewlyFilledIds(ids);
    setTimeout(() => setNewlyFilledIds(new Set()), 1500);
  }

  async function handleAutoAssign() {
    setAutoAssigning(true);
    try {
      const contentRes = await apiClient.get<{ success: boolean; data: { items: Array<{ id: string; calendarAssigned: boolean }> } }>("/api/content");
      const unassigned = (contentRes.data.data.items ?? []).filter((c) => !c.calendarAssigned);

      if (unassigned.length === 0) {
        toast.error("No unassigned content", "Generate content first.");
        return;
      }

      const res = await apiClient.post<{ success: boolean; data: { entries: CalendarEntry[]; count: number } }>("/api/calendar/auto-assign", { contentBatchId: unassigned[0].id });

      if (res.data.success) {
        markNewIds(new Set((res.data.data.entries ?? []).map((e) => e.id)));
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
      const res = await apiClient.get(`/api/calendar/export/${type}?month=${month}&year=${year}`, { responseType: "blob" });
      const blob = new Blob([res.data as BlobPart], { type: type === "pdf" ? "application/pdf" : "text/csv" });
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

  const progressPct = Math.min(100, Math.round((filledDays / daysInMonth) * 100));

  return (
    <div className="bd-flow">
      <div className="bd-pagehead">
        <div>
          <h1>Content calendar</h1>
          <p>Plan every post for the month. Click a day to view it, or an empty day to add content.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => handleExport("pdf")}><Download size={14} /> PDF</button>
          <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => handleExport("csv")}><FileText size={14} /> CSV</button>
          {hasUnassigned && (
            <button type="button" className="bd-btn bd-btn-primary bd-btn-sm" disabled={autoAssigning} onClick={handleAutoAssign}>
              {autoAssigning ? <Loader2 size={14} className="bd-spin-icon" /> : <Sparkles size={14} />} Auto-assign content
            </button>
          )}
        </div>
      </div>

      {/* progress + legend */}
      <div className="bd-card bd-progress-card bd-reveal">
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Monthly progress</span>
            <span className="bd-hint">{progressPct}% planned</span>
          </div>
          <div className="bd-pbar"><span style={{ width: `${Math.max(progressPct, filledDays ? 3 : 0)}%` }} /></div>
          <div className="bd-legend2">
            {(Object.keys(TYPE_CONFIG) as ContentType[]).map((t) => (
              <span key={t} className="bd-chip" style={{ background: TYPE_CONFIG[t].bg, color: TYPE_CONFIG[t].color }}>
                {TYPE_CONFIG[t].label} · {typeCounts[t] ?? 0}
              </span>
            ))}
          </div>
        </div>
        <div className="bd-pnum">{displayCount}<small> / {daysInMonth} days</small></div>
      </div>

      {/* month nav */}
      <div className="bd-calbar">
        <div className="bd-monthnav">
          <button type="button" className="bd-iconbtn" onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <h2>{MONTH_NAMES[month - 1]} <span>{year}</span></h2>
          <button type="button" className="bd-iconbtn" onClick={nextMonth} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
        {!isCurrentMonth && (
          <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={goToday}><CalendarDays size={14} /> Today</button>
        )}
      </div>

      {/* grid */}
      <div>
        <div className="bd-cal-wd" aria-hidden>
          {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
        </div>
        {loading ? (
          <div className="bd-cal-grid">
            {Array.from({ length: firstWeekday + daysInMonth }).map((_, i) => (
              <div key={i} className={i < firstWeekday ? "bd-cell blank" : "bd-skel"} style={i < firstWeekday ? undefined : { minHeight: 110, borderRadius: 20 }} />
            ))}
          </div>
        ) : (
          <div className="bd-cal-grid" key={`${month}-${year}`}>
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`b${i}`} className="bd-cell blank" />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const entry = dayMap.get(day);
              const wd = WEEKDAYS[(firstWeekday + day - 1) % 7];
              const isPast = year < today.getFullYear() || (year === today.getFullYear() && (month < today.getMonth() + 1 || (month === today.getMonth() + 1 && day < todayDate)));
              return (
                <DayCell
                  key={`${day}-${entry?.id ?? "empty"}`}
                  day={day}
                  weekday={wd}
                  entry={entry}
                  isNew={newlyFilledIds.has(entry?.id ?? "")}
                  isToday={isCurrentMonth && day === todayDate}
                  isPast={isPast}
                  onClickFilled={setSelectedEntry}
                  onClickEmpty={setAssignDay}
                />
              );
            })}
          </div>
        )}
      </div>

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
    </div>
  );
}
