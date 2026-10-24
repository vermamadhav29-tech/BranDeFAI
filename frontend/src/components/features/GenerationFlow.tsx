"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Check, Loader2, Copy, RefreshCw, Download, CalendarPlus, Pencil, Save, X, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";
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

const STEPS = ["Analyzing product image", "Writing captions & ad copy", "Generating visual assets", "Assembling your content pack"] as const;

// ─── Step indicator ───────────────────────────────────────────────────────────────

function ProgressStep({ label, index, state }: { label: string; index: number; state: "pending" | "active" | "done" }) {
  return (
    <div className={"bd-gstep is-" + state}>
      <span className="dot">
        {state === "done" && <Check size={15} strokeWidth={3} />}
        {state === "active" && <Loader2 size={15} className="bd-spin-icon" />}
        {state === "pending" && index + 1}
      </span>
      <span className="t">{label}</span>
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
    <div className="bd-card bd-gen bd-reveal">
      <div className="bd-pulse"><Sparkles size={32} color="#fff" /></div>
      <h2 className="bd-card-title" style={{ fontSize: 26, marginTop: 18 }}>Generating your content pack</h2>
      <p className="bd-card-sub">This usually takes 30–60 seconds. Keep this tab open.</p>
      <div className="bd-gsteps">
        {STEPS.map((step, i) => (
          <ProgressStep key={step} label={step} index={i} state={stepState(i)} />
        ))}
      </div>
    </div>
  );
}

// ─── Caption card ─────────────────────────────────────────────────────────────────

function CaptionCard({ text, index, isLoading, onRegenerate }: { text: string; index: number; isLoading: boolean; onRegenerate: (i: number) => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="bd-cap bd-dim">
      {isLoading && (
        <div className="veil"><Loader2 size={22} className="bd-spin-icon" style={{ color: "var(--p)" }} /></div>
      )}
      <span className="no">{index + 1}</span>
      <p>{text}</p>
      <div className="foot">
        <button type="button" className={"bd-btn bd-btn-sm " + (copied ? "bd-btn-green" : "bd-btn-ghost")} onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : "Copy"}
        </button>
        <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => onRegenerate(index)} disabled={isLoading}>
          <RefreshCw size={14} /> Regenerate <span className="bd-credit-note">2 cr</span>
        </button>
      </div>
    </div>
  );
}

// ─── Ad copy card ─────────────────────────────────────────────────────────────────

function AdCopyCard({ adCopy, isLoading, onRegenerate, onUpdate }: { adCopy: AdCopy; isLoading: boolean; onRegenerate: () => void; onUpdate: (updated: AdCopy) => void }) {
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
    <div className="bd-adcopy bd-dim">
      {isLoading && (
        <div className="veil"><Loader2 size={22} className="bd-spin-icon" style={{ color: "var(--p)" }} /></div>
      )}

      {editing ? (
        <div>
          <div className="bd-field">
            <label className="bd-label" htmlFor="ad-h">Headline</label>
            <input id="ad-h" className="bd-input" type="text" value={draft.headline} onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))} />
          </div>
          <div className="bd-field">
            <label className="bd-label" htmlFor="ad-b">Body</label>
            <textarea id="ad-b" className="bd-textarea" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} rows={3} />
          </div>
          <div className="bd-field">
            <label className="bd-label" htmlFor="ad-c">Call to action</label>
            <input id="ad-c" className="bd-input" type="text" value={draft.cta} onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="bd-btn bd-btn-primary bd-btn-sm" onClick={handleSave}><Save size={14} /> Save</button>
            <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => setEditing(false)}><X size={14} /> Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <h3>{adCopy.headline}</h3>
          <p>{adCopy.body}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span className="bd-chip g">CTA: {adCopy.cta}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={handleEdit}><Pencil size={14} /> Edit</button>
              <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={onRegenerate} disabled={isLoading}>
                <RefreshCw size={14} /> Regenerate <span className="bd-credit-note">2 cr</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Reel card ─────────────────────────────────────────────────────────────────────

function ReelCard({ idea }: { idea: ReelIdea }) {
  return (
    <div className="bd-reel">
      <q>{idea.hook}</q>
      <ol className="bd-shots">
        {idea.shotList.map((shot, i) => (
          <li key={i}>{shot}</li>
        ))}
      </ol>
    </div>
  );
}

// ─── Image card ──────────────────────────────────────────────────────────────────

function ImageCard({ url, index, contentId, onToast }: { url: string | null; index: number; contentId: string; onToast: (msg: string, ok?: boolean) => void }) {
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
      await apiClient.post("/api/calendar/auto-assign", { contentBatchId: contentId });
      setAddedToCalendar(true);
      onToast("Image added to your content calendar!");
    } catch {
      onToast("Could not add to calendar. Try “Save all to calendar”.", false);
    }
  }

  if (!url) {
    return (
      <div className="bd-shot missing">
        <div>
          <X size={22} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>Generation failed</div>
          <div>Retry with your next content batch</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bd-shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Generated image ${index + 1}`} loading="lazy" />
      <div className="over" style={{ justifyContent: "space-between", gap: 6 }}>
        <button type="button" className="bd-btn bd-btn-sm" style={{ background: "#fff", color: "var(--ink)" }} onClick={handleDownload} disabled={downloading}>
          {downloading ? <Loader2 size={14} className="bd-spin-icon" /> : <Download size={14} />} Download
        </button>
        <button type="button" className="bd-btn bd-btn-sm" style={{ background: "#fff", color: "var(--ink)" }} onClick={handleAddToCalendar} disabled={addedToCalendar}>
          {addedToCalendar ? <Check size={14} /> : <CalendarPlus size={14} />} {addedToCalendar ? "Added!" : "Calendar"}
        </button>
      </div>
    </div>
  );
}

// ─── Error view ──────────────────────────────────────────────────────────────────

function ErrorView({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="bd-card bd-gen bd-reveal">
      <span className="bd-stat-ico" style={{ width: 64, height: 64, borderRadius: 22, background: "var(--red-bg)", color: "var(--red)" }}><X size={28} /></span>
      <h2 className="bd-card-title" style={{ fontSize: 24, marginTop: 14 }}>Generation failed</h2>
      <p className="bd-card-sub" style={{ maxWidth: 420 }}>{message}</p>
      <button type="button" className="bd-btn bd-btn-dark" style={{ marginTop: 14 }} onClick={onReset}>
        <RefreshCw size={16} /> Try again
      </button>
    </div>
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

  function showToast(msg: string, ok = true) {
    if (ok) toast.success(msg);
    else toast.error(msg);
  }

  // Step timer (visual-only, spreads across the expected 30-60s generation window)
  useEffect(() => {
    if (flowState !== "generating") return;
    const timers = [setTimeout(() => setActiveStep(1), 10_000), setTimeout(() => setActiveStep(2), 25_000), setTimeout(() => setActiveStep(3), 45_000)];
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
        const res = await apiClient.post<ApiData<CaptionResponse>>(`/api/content/${result.contentId}/regenerate-caption`);
        if (res.data.success && res.data.data?.caption) {
          setCaptions([res.data.data.caption.full_caption]);
          setHasMoreAlternates(res.data.data.hasMoreAlternates);
          if (user) updateCredits(Math.max(0, user.creditsBalance - 2));
        }
      } catch {
        showToast("Regeneration failed. Please try again.", false);
      } finally {
        setCaptionLoading((prev) => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }
    },
    [result, user, updateCredits],
  );

  const handleShowAnotherCaption = useCallback(async () => {
    if (!result) return;
    setAlternateLoading(true);
    try {
      const res = await apiClient.post<ApiData<CaptionResponse>>(`/api/content/${result.contentId}/caption/next-alternate`);
      if (res.data.success && res.data.data?.caption) {
        setCaptions([res.data.data.caption.full_caption]);
        setHasMoreAlternates(res.data.data.hasMoreAlternates);
      }
    } catch {
      showToast("No more alternate versions. Try Regenerate for fresh captions.", false);
      setHasMoreAlternates(false);
    } finally {
      setAlternateLoading(false);
    }
  }, [result]);

  const handleRegenerateAdCopy = useCallback(async () => {
    if (!result) return;
    setAdCopyLoading(true);
    try {
      const res = await apiClient.post<ApiData<{ adCopy: AdCopy }>>(`/api/content/${result.contentId}/regenerate-adcopy`);
      if (res.data.success && res.data.data?.adCopy) {
        setAdCopy(res.data.data.adCopy);
        if (user) updateCredits(Math.max(0, user.creditsBalance - 2));
      }
    } catch {
      showToast("Regeneration failed. Please try again.", false);
    } finally {
      setAdCopyLoading(false);
    }
  }, [result, user, updateCredits]);

  const handleSaveAllToCalendar = useCallback(async () => {
    if (!result || calendarSaved || calendarLoading) return;
    setCalendarLoading(true);
    try {
      // the API expects the content batch id as `contentBatchId`
      await apiClient.post("/api/calendar/auto-assign", { contentBatchId: result.contentId });
      setCalendarSaved(true);
      showToast("Added to your content calendar!");
    } catch {
      showToast("Could not save to calendar. Please try again.", false);
    } finally {
      setCalendarLoading(false);
    }
  }, [result, calendarSaved, calendarLoading]);

  // ── Render ──────────────────────────────────────────────────────────────────────

  if (flowState === "generating") return <GeneratingView activeStep={activeStep} />;
  if (flowState === "error") return <ErrorView message={errorMsg ?? "Something went wrong."} onReset={onReset} />;
  if (!result || !adCopy) return null;

  return (
    <div className="bd-flow">
      <div className="bd-pagehead">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1>Your content pack is ready</h1>
            <span className="bd-chip p">20 credits used</span>
          </div>
          <p>Review, tweak and save everything to your calendar.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="bd-btn bd-btn-ghost" onClick={onReset}>
            <RefreshCw size={16} /> Generate new
          </button>
          <button type="button" className="bd-btn bd-btn-primary" onClick={handleSaveAllToCalendar} disabled={calendarSaved || calendarLoading}>
            {calendarLoading ? <Loader2 size={16} className="bd-spin-icon" /> : calendarSaved ? <Check size={16} /> : <CalendarPlus size={16} />}
            {calendarSaved ? "Saved to calendar" : "Save all to calendar"}
          </button>
        </div>
      </div>

      <section className="bd-card bd-reveal">
        <div className="bd-card-head">
          <div>
            <h2 className="bd-card-title">Instagram captions</h2>
            <p className="bd-card-sub">{captions.length > 1 ? "Choose your favourite or use all of them." : "The AI's top pick for this post."}</p>
          </div>
        </div>
        <div className="bd-caps">
          {captions.map((caption, i) => (
            <CaptionCard key={i} text={caption} index={i} isLoading={captionLoading.has(i)} onRegenerate={handleRegenerateCaption} />
          ))}
        </div>
        {captions.length === 1 && hasMoreAlternates && (
          <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" style={{ marginTop: 14 }} onClick={handleShowAnotherCaption} disabled={alternateLoading}>
            {alternateLoading ? <Loader2 size={14} className="bd-spin-icon" /> : <RefreshCw size={14} />} Show me another <span className="bd-credit-note">free</span>
          </button>
        )}
      </section>

      <section className="bd-card bd-reveal">
        <div className="bd-card-head">
          <div>
            <h2 className="bd-card-title">Ad copy</h2>
            <p className="bd-card-sub">Edit it inline, or regenerate for a fresh angle.</p>
          </div>
        </div>
        <AdCopyCard adCopy={adCopy} isLoading={adCopyLoading} onRegenerate={handleRegenerateAdCopy} onUpdate={setAdCopy} />
      </section>

      <section className="bd-card bd-reveal">
        <div className="bd-card-head">
          <div>
            <h2 className="bd-card-title">Reel ideas</h2>
            <p className="bd-card-sub">A hook and a full shot-by-shot breakdown for each idea.</p>
          </div>
        </div>
        <div className="bd-grid-2">
          {(result.reelIdeas as ReelIdea[]).map((idea, i) => (
            <ReelCard key={i} idea={idea} />
          ))}
        </div>
      </section>

      <section className="bd-card bd-reveal">
        <div className="bd-card-head">
          <div>
            <h2 className="bd-card-title">AI-generated visuals</h2>
            <p className="bd-card-sub">Hover an image to download it or add it to your calendar.</p>
          </div>
        </div>
        <div className="bd-gallery">
          {(result.images as (string | null)[]).map((url, i) => (
            <ImageCard key={i} url={url} index={i} contentId={result.contentId} onToast={showToast} />
          ))}
        </div>
      </section>

      <div className="bd-actionbar">
        <div className="info">
          {calendarSaved ? (
            <>
              <CheckCircle2 size={18} style={{ color: "var(--green)" }} />
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>Saved to calendar!</span>
            </>
          ) : (
            <span>Ready to schedule your content?</span>
          )}
        </div>
        {calendarSaved ? (
          <Link href="/calendar" className="bd-btn bd-btn-primary">
            View calendar <ArrowRight size={16} />
          </Link>
        ) : (
          <button type="button" className="bd-btn bd-btn-primary" onClick={handleSaveAllToCalendar} disabled={calendarLoading}>
            {calendarLoading ? <Loader2 size={16} className="bd-spin-icon" /> : <CalendarPlus size={16} />} Save all to calendar
          </button>
        )}
      </div>
    </div>
  );
}

export default GenerationFlow;
