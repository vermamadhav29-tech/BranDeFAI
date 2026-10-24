"use client";

import { useState, useRef, useEffect, useCallback, useId, useMemo } from "react";
import Link from "next/link";
import { GenerationFlow } from "@/components/features/GenerationFlow";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  Zap,
  CalendarCheck,
  Image as ImageIcon,
  X,
  Loader2,
  Sparkles,
  Camera,
  CheckCircle2,
  UploadCloud,
  ArrowRight,
  Clock,
  PenLine,
  Film,
  CalendarDays,
  FileText,
  Megaphone,
  Check,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useBrandStore } from "@/stores/brandStore";
import apiClient from "@/lib/apiClient";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TrendPoint { day: string; value: number }
interface Trends {
  credits: TrendPoint[];
  content: TrendPoint[];
  calendar: TrendPoint[];
  images: TrendPoint[];
  weeklyContent: number;
  weeklyImages: number;
  imagesThisMonth: number;
}
type EntryType = "CAPTION" | "REEL_IDEA" | "AD_COPY" | "IMAGE" | "VIDEO";
interface CalEntry {
  id: string;
  calendarDay: number;
  month: number;
  year: number;
  contentType: EntryType;
  status: "SCHEDULED" | "PUBLISHED" | "SKIPPED";
  suggestedTime?: string | null;
  preview?: unknown;
}
interface Occasion { name: string; emoji: string; days_away: number; hook: string }
interface Txn { id: string; amount: number; type: string; balanceAfter: number; createdAt: string }

// ─── Constants & helpers ───────────────────────────────────────────────────────

const PLAN_MAX = { FREE: 50, PRO: 500, BUSINESS: 2000 } as const;
type PlanKey = keyof typeof PLAN_MAX;

const ENTRY_META: Record<EntryType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  CAPTION: { label: "Caption", icon: FileText, color: "var(--p)", bg: "var(--tint)" },
  REEL_IDEA: { label: "Reel", icon: Film, color: "var(--blue)", bg: "var(--blue-bg)" },
  AD_COPY: { label: "Ad copy", icon: Megaphone, color: "var(--green)", bg: "var(--green-bg)" },
  IMAGE: { label: "Image", icon: ImageIcon, color: "var(--orange)", bg: "var(--orange-bg)" },
  VIDEO: { label: "Video", icon: Film, color: "var(--pink)", bg: "var(--pink-bg)" },
};

const TXN_LABEL: Record<string, string> = {
  PLAN_ALLOCATION: "Monthly credits added",
  PURCHASE: "Credit pack purchased",
  GENERATION: "Content generated",
  VIDEO_EXPORT: "Video exported",
  STRATEGY: "Brand strategy created",
  VIDEO_SCENE: "Video scene generated",
  REFUND: "Credits refunded",
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function previewText(e: CalEntry): string {
  const p = e.preview;
  if (!p) return ENTRY_META[e.contentType]?.label ?? "Post";
  if (typeof p === "string") return p;
  const o = p as Record<string, unknown>;
  if (typeof o.hook === "string") return o.hook;
  if (typeof o.headline === "string") return o.headline;
  if (typeof o.imageUrl === "string") return "AI image";
  return ENTRY_META[e.contentType]?.label ?? "Post";
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Skel({ w = "100%", h = 16, r = 10 }: { w?: number | string; h?: number; r?: number }) {
  return <div className="bd-skel" style={{ width: w, height: h, borderRadius: r }} />;
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, warn, icon: Icon, tint, color, loading, progress, spark, delay,
}: {
  label: string; value: number; sub?: string; warn?: boolean; icon: React.ElementType;
  tint: string; color: string; loading?: boolean; progress?: number; spark?: TrendPoint[]; delay: number;
}) {
  const gid = useId().replace(/:/g, "");
  const total = spark?.reduce((s, p) => s + p.value, 0) ?? 0;
  return (
    <div className="bd-card bd-stat bd-reveal" style={{ animationDelay: `${delay}ms` }}>
      <div className="bd-stat-top">
        <div className="bd-stat-ico" style={{ background: tint, color }}>
          <Icon size={19} />
        </div>
        {spark && !loading && total > 0 && (
          <span className="bd-trend up">
            <TrendingUp size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
            Last 7 days
          </span>
        )}
      </div>
      <p className="bd-stat-label">{label}</p>
      {loading ? <Skel w={90} h={34} /> : <p className="bd-stat-value">{value.toLocaleString()}</p>}
      {sub && (loading ? <div style={{ marginTop: 8 }}><Skel w={140} h={12} /></div> : <p className={"bd-stat-sub" + (warn ? " warn" : "")}>{sub}</p>)}
      {progress !== undefined && !loading && (
        <div className="bd-bar" style={{ marginTop: 14 }}>
          <span style={{ width: `${Math.max(Math.min(progress, 1) * 100, 2)}%` }} />
        </div>
      )}
      {spark && spark.length > 1 && total > 0 && !loading && progress === undefined && (
        <div className="bd-stat-spark">
          <ResponsiveContainer width="100%" height={54}>
            <AreaChart data={spark} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#g${gid})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Setup checklist ───────────────────────────────────────────────────────────

function SetupCard({ steps }: { steps: { label: string; href: string; done: boolean }[] }) {
  const done = steps.filter((s) => s.done).length;
  const pct = done / steps.length;
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <div className="bd-card bd-setup bd-reveal">
      <div className="bd-ring" aria-label={`${done} of ${steps.length} steps complete`}>
        <svg width="108" height="108" viewBox="0 0 108 108">
          <circle cx="54" cy="54" r={R} fill="none" stroke="#e8e5fb" strokeWidth="9" />
          <circle cx="54" cy="54" r={R} fill="none" stroke="var(--p)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }} />
        </svg>
        <div className="bd-ring-label">{done}/{steps.length}</div>
      </div>
      <div>
        <h2 className="bd-card-title">Get your brand running on autopilot</h2>
        <p className="bd-card-sub">Finish these steps and BrandefAI will plan, create and schedule your content for you.</p>
        <div className="bd-steps">
          {steps.map((s) => (
            <Link key={s.label} href={s.href} className={"bd-step" + (s.done ? " is-done" : "")}>
              <span className="tick">{s.done ? <Check size={14} strokeWidth={3} /> : null}</span>
              <span className="t">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Quick action ──────────────────────────────────────────────────────────────

function ActionCard({
  href, icon: Icon, title, subtitle, tint, color,
}: { href: string; icon: React.ElementType; title: string; subtitle: string; tint: string; color: string }) {
  return (
    <Link href={href} className="bd-action">
      <span className="ico" style={{ background: tint, color }}>
        <Icon size={24} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <ArrowRight size={20} className="arrow" />
    </Link>
  );
}

// ─── Upload zone (single product → full content pack) ──────────────────────────

function UploadZone({
  file, preview, onSelect, onRemove,
}: { file: File | null; preview: string | null; onSelect: (f: File) => void; onRemove: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onSelect(f);
  }

  if (preview && file) {
    return (
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div className="bd-thumb" style={{ width: 96, height: 96, flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Product preview" />
          <button type="button" onClick={onRemove} aria-label="Remove image"><X size={12} /></button>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--gray)" }}>{(file.size / 1024 / 1024).toFixed(1)} MB · ready to generate</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={"bd-drop" + (isDragging ? " is-over" : "")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => handleFiles(e.target.files)} />
      <span className="ico"><UploadCloud size={26} /></span>
      <b>Drop a product photo here</b>
      <span>or click to browse · JPG, PNG, WebP</span>
    </div>
  );
}

// ─── Ready for you (posts awaiting approval) ──────────────────────────────────

type PostStatus = "PENDING_APPROVAL" | "APPROVED" | "SCHEDULED" | "POSTED";
interface PendingPost {
  id: string;
  imageUrl: string;
  caption: string | null;
  occasionName: string | null;
  occasionEmoji: string | null;
  status: PostStatus;
}

function ReadyForYouSection() {
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: { posts: PendingPost[] } }>("/api/creative/posts?status=PENDING_APPROVAL&limit=3")
      .then((res) => {
        if (res.data.success && res.data.data?.posts) setPosts(res.data.data.posts.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function handleApprove(postId: string) {
    setApprovingId(postId);
    try {
      await apiClient.patch(`/api/creative/posts/${postId}/status`, { status: "APPROVED" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      // silently ignore
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="bd-card bd-reveal">
      <div className="bd-card-head">
        <div>
          <h2 className="bd-card-title">Ready for you</h2>
          <p className="bd-card-sub">AI posts made from your brand and upcoming occasions, waiting for your approval.</p>
        </div>
        <Link href="/images" className="bd-link">View all <ArrowRight size={14} /></Link>
      </div>

      {!loaded ? (
        <div className="bd-posts">
          {[0, 1, 2].map((i) => <div key={i} className="bd-skel" style={{ aspectRatio: "4 / 5.6", borderRadius: 22 }} />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="bd-empty">
          <strong>Nothing waiting for approval</strong>
          Upload product photos in <Link href="/images" className="bd-link" style={{ display: "inline" }}>Image Studio</Link> and BrandefAI will draft posts for you.
        </div>
      ) : (
        <div className="bd-posts">
          {posts.map((post) => (
            <div key={post.id} className="bd-post">
              <div className="bd-post-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.imageUrl} alt="AI-generated post" loading="lazy" />
                <div className="bd-post-badges">
                  {post.occasionName ? <span className="bd-chip">{post.occasionName}</span> : <span />}
                  <span className="bd-chip a"><Clock size={11} /> Pending</span>
                </div>
              </div>
              <div className="bd-post-body">
                {(post.caption ?? "").slice(0, 90) || <span style={{ color: "var(--muted)" }}>No caption yet</span>}
              </div>
              <div className="bd-post-foot">
                <button type="button" className="bd-btn bd-btn-green bd-btn-sm" style={{ flex: 1 }} onClick={() => handleApprove(post.id)} disabled={approvingId === post.id}>
                  {approvingId === post.id ? <Loader2 size={14} className="bd-spin-icon" /> : <CheckCircle2 size={14} />} Approve
                </button>
                <Link href="/images" className="bd-btn bd-btn-ghost bd-btn-sm">View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bulk product posts ────────────────────────────────────────────────────────

interface BulkPendingFile { uid: string; file: File; preview: string }
type BulkPhase = "idle" | "uploading" | "analyzing" | "generating" | "done";

function BulkProductPostsSection() {
  const [pendingFiles, setPendingFiles] = useState<BulkPendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<BulkPhase>("idle");
  const [doneImages, setDoneImages] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [finalCount, setFinalCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    return () => { pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.preview)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(rawFiles: FileList | File[]) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const valid = Array.from(rawFiles).filter((f) => allowed.includes(f.type) && f.size <= 10 * 1024 * 1024);
    const remaining = 15 - pendingFiles.length;
    const toAdd = valid.slice(0, Math.max(0, remaining)).map((f) => ({
      uid: Math.random().toString(36).slice(2),
      file: f,
      preview: URL.createObjectURL(f),
    }));
    if (toAdd.length) setPendingFiles((prev) => [...prev, ...toAdd]);
  }

  function removeFile(uid: string) {
    setPendingFiles((prev) => {
      const removed = prev.find((pf) => pf.uid === uid);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((pf) => pf.uid !== uid);
    });
  }

  function reset() {
    pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
    setPendingFiles([]);
    setPhase("idle");
    setDoneImages(0);
    setTotalImages(0);
    setFinalCount(0);
    setErrorMsg("");
  }

  const handleGenerate = useCallback(async () => {
    if (!pendingFiles.length || phase !== "idle") return;
    setErrorMsg("");
    try {
      setPhase("uploading");
      const formData = new FormData();
      pendingFiles.forEach((pf) => formData.append("images", pf.file));
      const uploadRes = await apiClient.post<{ success: boolean; data: { images: Array<{ id: string }> }; error: string | null }>("/api/uploads/bulk-product-images", formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (!uploadRes.data.success || !uploadRes.data.data?.images?.length) throw new Error(uploadRes.data.error ?? "Upload failed");
      const productImageIds = uploadRes.data.data.images.map((i) => i.id);

      setPhase("analyzing");
      const briefRes = await apiClient.post<{ success: boolean; data: { briefs: Array<{ id: string }> }; error: string | null }>("/api/images/generate-post-briefs", { productImageIds });
      if (!briefRes.data.success || !briefRes.data.data?.briefs?.length) throw new Error(briefRes.data.error ?? "Brief generation failed");
      const briefs = briefRes.data.data.briefs;
      const total = briefs.length * 2;
      setTotalImages(total);
      setDoneImages(0);
      setPhase("generating");

      let generated = 0;
      for (const brief of briefs) {
        for (let img = 1; img <= 2; img++) {
          try {
            const postRes = await apiClient.post<{ success: boolean; error: string | null }>("/api/images/generate-product-posts", { briefId: brief.id });
            if (postRes.data.success) { generated += 1; setDoneImages(generated); }
          } catch { /* partial failure — continue */ }
          if (img < 2) await new Promise((r) => setTimeout(r, 3000));
        }
      }
      setFinalCount(generated);
      setPhase("done");
      pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
      setPendingFiles([]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setErrorMsg(e.response?.data?.error ?? e.message ?? "Something went wrong.");
      setPhase("idle");
    }
  }, [pendingFiles, phase]);

  const isBusy = phase === "uploading" || phase === "analyzing" || phase === "generating";
  const progressPct = totalImages > 0 ? doneImages / totalImages : 0;
  const phaseLabel: Record<BulkPhase, string> = {
    idle: "", uploading: "Uploading product images…", analyzing: "Analyzing products & writing briefs…",
    generating: `Generating posts… ${doneImages} of ${totalImages} complete`, done: "",
  };

  if (phase === "done") {
    return (
      <div className="bd-card bd-reveal">
        <div className="bd-success">
          <span className="ico"><CheckCircle2 size={24} /></span>
          <div>
            <h2 className="bd-card-title">{finalCount} post{finalCount !== 1 ? "s" : ""} ready!</h2>
            <p className="bd-card-sub">Your promotional Instagram images have been saved to Image Studio.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <Link href="/images" className="bd-btn bd-btn-primary bd-btn-sm">View in Image Studio</Link>
              <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={reset}>Generate more</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bd-card bd-reveal">
      <div className="bd-card-head">
        <div>
          <h2 className="bd-card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="bd-stat-ico" style={{ width: 34, height: 34, borderRadius: 12, background: "var(--pink-bg)", color: "var(--pink)" }}><Camera size={17} /></span>
            Product posts in bulk
          </h2>
          <p className="bd-card-sub">Upload up to 15 product photos. AI creates 2 promotional Instagram posts (1080×1350) per product in your brand style.</p>
        </div>
        <span className="bd-chip p">10 credits / product</span>
      </div>

      <input ref={fileInputRef} type="file" multiple hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

      {pendingFiles.length > 0 ? (
        <div>
          <div className="bd-thumbs">
            {pendingFiles.map((pf) => (
              <div key={pf.uid} className="bd-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pf.preview} alt={pf.file.name} />
                {!isBusy && <button type="button" onClick={() => removeFile(pf.uid)} aria-label="Remove"><X size={11} /></button>}
              </div>
            ))}
            {pendingFiles.length < 15 && !isBusy && (
              <button type="button" className="bd-thumb add" onClick={() => fileInputRef.current?.click()} aria-label="Add more images">+</button>
            )}
          </div>
          <p className="bd-card-sub" style={{ marginTop: 12 }}>{pendingFiles.length}/15 images · {pendingFiles.length * 2} posts will be generated</p>
        </div>
      ) : (
        <div
          className={"bd-drop" + (dragOver ? " is-over" : "")}
          role="button"
          tabIndex={0}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !isBusy && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        >
          <span className="ico"><UploadCloud size={26} /></span>
          <b>Click to upload or drag &amp; drop</b>
          <span>Up to 15 images · JPEG, PNG, WebP · max 10 MB each</span>
        </div>
      )}

      {isBusy && (
        <div>
          <div className="bd-busy"><Loader2 size={16} className="bd-spin-icon" /> {phaseLabel[phase]}</div>
          {phase === "generating" && <div className="bd-progress"><span style={{ width: `${progressPct * 100}%` }} /></div>}
        </div>
      )}
      {errorMsg && <p className="bd-error">{errorMsg}</p>}

      {!isBusy && pendingFiles.length > 0 && (
        <button type="button" className="bd-btn bd-btn-primary" style={{ marginTop: 16 }} onClick={handleGenerate}>
          <Sparkles size={16} /> Generate {pendingFiles.length * 2} product posts
        </button>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const brand = useBrandStore((s) => s.brand);

  // single product → content pack flow
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [productImageId, setProductImageId] = useState<string | null>(null);

  function handleFileSelect(f: File) { setUploadFile(f); setUploadPreview(URL.createObjectURL(f)); setUploadError(""); }
  function handleFileRemove() { if (uploadPreview) URL.revokeObjectURL(uploadPreview); setUploadFile(null); setUploadPreview(null); setUploadError(""); }
  function handleReset() { setProductImageId(null); setUploadFile(null); if (uploadPreview) URL.revokeObjectURL(uploadPreview); setUploadPreview(null); setUploadError(""); }

  async function handleUploadAndGenerate() {
    if (!uploadFile || isUploading) return;
    setIsUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("image", uploadFile);
      const res = await apiClient.post<{ success: boolean; data: { productImageId: string } }>("/api/uploads/product-image", form, { headers: { "Content-Type": "multipart/form-data" } });
      if (res.data.success && res.data.data) setProductImageId(res.data.data.productImageId);
      else setUploadError("Upload failed. Please try again.");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setUploadError(e.response?.data?.error ?? e.message ?? "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  // dashboard data
  const [trends, setTrends] = useState<Trends | null>(null);
  const [postsTotal, setPostsTotal] = useState(0);
  const [entries, setEntries] = useState<CalEntry[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const daysInMonth = new Date(year, month, 0).getDate();
    const needsNext = now.getDate() + 6 > daysInMonth;
    const next = new Date(year, month, 1);

    Promise.allSettled([
      apiClient.get<{ success: boolean; data: Trends }>("/api/dashboard/trends"),
      apiClient.get<{ success: boolean; data: { total: number } }>("/api/creative/posts?limit=1"),
      apiClient.get<{ success: boolean; data: { entries: CalEntry[] } }>(`/api/calendar?month=${month}&year=${year}`),
      needsNext
        ? apiClient.get<{ success: boolean; data: { entries: CalEntry[] } }>(`/api/calendar?month=${next.getMonth() + 1}&year=${next.getFullYear()}`)
        : Promise.resolve(null),
      apiClient.get<{ success: boolean; data: { occasions: Occasion[] } }>("/api/creative/occasions"),
      apiClient.get<{ success: boolean; data: { transactions: Txn[] } }>("/api/credits/history"),
    ])
      .then(([t, p, c1, c2, o, h]) => {
        if (t.status === "fulfilled" && t.value.data.success) setTrends(t.value.data.data);
        if (p.status === "fulfilled" && p.value.data.success) setPostsTotal(p.value.data.data.total ?? 0);
        const merged: CalEntry[] = [];
        for (const r of [c1, c2]) {
          if (r.status === "fulfilled" && r.value && r.value.data.success) merged.push(...(r.value.data.data.entries ?? []));
        }
        setEntries(merged);
        if (o.status === "fulfilled" && o.value.data.success) setOccasions(o.value.data.data.occasions ?? []);
        if (h.status === "fulfilled" && h.value.data.success) setTxns((h.value.data.data.transactions ?? []).slice(0, 6));
      })
      .finally(() => setLoading(false));
  }, []);

  // derived
  const creditsBalance = user?.creditsBalance ?? 0;
  const max = PLAN_MAX[(user?.plan as PlanKey) ?? "FREE"] ?? 50;
  const isLowCredits = creditsBalance < max * 0.2;
  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1, 1);
  const resetsDate = nextReset.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const planLabel = (user?.plan ?? "FREE").charAt(0).toUpperCase() + (user?.plan ?? "FREE").slice(1).toLowerCase();

  const now = new Date();
  const monthEntries = useMemo(
    () => entries.filter((e) => e.month === now.getMonth() + 1 && e.year === now.getFullYear()).length,
    [entries], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const week = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const list = entries.filter((e) => e.calendarDay === d.getDate() && e.month === d.getMonth() + 1 && e.year === d.getFullYear());
      return { date: d, list };
    });
  }, [entries]);
  const upcoming = week.flatMap((d) => d.list.map((e) => ({ e, date: d.date }))).filter((x) => x.e.status !== "SKIPPED").slice(0, 4);

  const hasContent = (trends?.weeklyContent ?? 0) > 0 || postsTotal > 0 || monthEntries > 0 || txns.some((t) => t.type === "GENERATION");
  const steps = [
    { label: "Set up your brand", href: "/settings", done: !!brand },
    { label: "Approve your strategy", href: "/strategy", done: !!brand?.strategyApproved },
    { label: "Create your first content", href: "/content", done: hasContent },
    { label: "Fill your calendar", href: "/calendar", done: monthEntries > 0 },
  ];
  const setupDone = steps.every((s) => s.done);

  const name = brand?.brandName ?? user?.email?.split("@")[0] ?? "there";

  if (productImageId) {
    return <GenerationFlow productImageId={productImageId} onReset={handleReset} />;
  }

  return (
    <div className="bd-dash">
      {/* welcome */}
      <div className="bd-hello">
        <div>
          <h1>{getGreeting()}, {name}</h1>
          <p>{getFormattedDate()}</p>
        </div>
        <div className="bd-hello-actions">
          <Link href="/calendar" className="bd-btn bd-btn-ghost"><CalendarDays size={17} /> Plan my month</Link>
          <Link href="/content" className="bd-btn bd-btn-primary"><Sparkles size={17} /> Create content</Link>
        </div>
      </div>

      {/* low credits */}
      {isLowCredits && !loading && (
        <div className="bd-alert bd-reveal" role="status">
          <AlertTriangle size={20} />
          <span><strong>You&apos;re running low on credits</strong> — {creditsBalance} left. Top up to keep generating without interruption.</span>
          <Link href="/credits" className="bd-link">Get credits <ArrowRight size={14} /></Link>
        </div>
      )}

      {/* setup */}
      {!loading && !setupDone && <SetupCard steps={steps} />}

      {/* stats */}
      <div className="bd-stats">
        <StatCard
          label="Credits remaining" value={creditsBalance} icon={Zap} tint="var(--tint)" color="#5235ef"
          sub={`${planLabel} plan · resets ${resetsDate}`} warn={isLowCredits} progress={creditsBalance / max} delay={0}
        />
        <StatCard
          label="Content this week" value={trends?.weeklyContent ?? 0} icon={Sparkles} tint="var(--blue-bg)" color="#2f6bff"
          sub={(trends?.weeklyContent ?? 0) > 0 ? "captions, reels & ad copy" : "Nothing generated yet this week"}
          loading={loading} spark={trends?.content} delay={60}
        />
        <StatCard
          label="Calendar this month" value={monthEntries} icon={CalendarCheck} tint="var(--green-bg)" color="#1ba672"
          sub={`${monthEntries} of 30 days planned`} loading={loading} progress={monthEntries / 30} delay={120}
        />
        <StatCard
          label="AI posts created" value={postsTotal} icon={ImageIcon} tint="var(--orange-bg)" color="#f0703a"
          sub={`${trends?.imagesThisMonth ?? 0} images this month`} loading={loading} spark={trends?.images} delay={180}
        />
      </div>

      <div className="bd-cols">
        {/* main column */}
        <div className="bd-stack">
          <div className="bd-card bd-reveal">
            <div className="bd-card-head">
              <div>
                <h2 className="bd-card-title">What do you want to create today?</h2>
                <p className="bd-card-sub">Pick a starting point — everything is written in your brand voice.</p>
              </div>
            </div>
            <div className="bd-actions">
              <ActionCard href="/content" icon={PenLine} title="Write a post" subtitle="Captions, reel hooks and ad copy" tint="var(--tint)" color="#5235ef" />
              <ActionCard href="/images" icon={ImageIcon} title="Make an image" subtitle="Product photos and promo creatives" tint="var(--orange-bg)" color="#f0703a" />
              <ActionCard href="/videos" icon={Film} title="Create a video" subtitle="Cinematic reels from a product photo" tint="var(--pink-bg)" color="#e0488a" />
              <ActionCard href="/calendar" icon={CalendarDays} title="Plan my month" subtitle="30 days of content, scheduled" tint="var(--green-bg)" color="#1ba672" />
            </div>
          </div>

          <div className="bd-card bd-reveal">
            <div className="bd-card-head">
              <div>
                <h2 className="bd-card-title">Quick content pack</h2>
                <p className="bd-card-sub">Upload one product photo and get 3 captions, 2 reel hooks and ad copy in about a minute.</p>
              </div>
              <span className="bd-chip p">Uses credits</span>
            </div>
            <UploadZone file={uploadFile} preview={uploadPreview} onSelect={handleFileSelect} onRemove={handleFileRemove} />
            {uploadError && <p className="bd-error">{uploadError}</p>}
            {uploadFile && (
              <button type="button" className="bd-btn bd-btn-primary" style={{ marginTop: 16 }} onClick={handleUploadAndGenerate} disabled={isUploading}>
                {isUploading ? <><Loader2 size={16} className="bd-spin-icon" /> Uploading…</> : <><Sparkles size={16} /> Generate content pack</>}
              </button>
            )}
          </div>

          <ReadyForYouSection />
          <BulkProductPostsSection />
        </div>

        {/* side column */}
        <div className="bd-stack">
          <div className="bd-card bd-reveal">
            <div className="bd-card-head">
              <div>
                <h2 className="bd-card-title">This week</h2>
                <p className="bd-card-sub">What&apos;s scheduled over the next 7 days</p>
              </div>
              <Link href="/calendar" className="bd-link">Calendar <ArrowRight size={14} /></Link>
            </div>
            <div className="bd-week">
              {week.map(({ date, list }, i) => (
                <div key={i} className={"bd-day" + (i === 0 ? " is-today" : "")}>
                  <small>{date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3)}</small>
                  <b>{date.getDate()}</b>
                  <div className="dots">
                    {list.slice(0, 3).map((e) => <i key={e.id} style={{ background: i === 0 ? "#fff" : ENTRY_META[e.contentType]?.color }} />)}
                  </div>
                </div>
              ))}
            </div>
            {loading ? (
              <div style={{ display: "grid", gap: 10 }}><Skel h={44} r={14} /><Skel h={44} r={14} /></div>
            ) : upcoming.length === 0 ? (
              <div className="bd-empty">
                <strong>Nothing scheduled</strong>
                <Link href="/calendar" className="bd-link" style={{ display: "inline-flex" }}>Plan your month →</Link>
              </div>
            ) : (
              <div className="bd-list">
                {upcoming.map(({ e, date }) => {
                  const m = ENTRY_META[e.contentType] ?? ENTRY_META.CAPTION;
                  const Icon = m.icon;
                  return (
                    <Link key={e.id} href="/calendar" className="bd-row">
                      <span className="ico" style={{ background: m.bg, color: m.color }}><Icon size={17} /></span>
                      <span className="main">
                        <b>{previewText(e)}</b>
                        <span>{m.label} · {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{e.suggestedTime ? ` · ${e.suggestedTime}` : ""}</span>
                      </span>
                      {e.status === "PUBLISHED" && <span className="bd-chip g">Posted</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {occasions.length > 0 && (
            <div className="bd-card bd-reveal">
              <div className="bd-card-head">
                <div>
                  <h2 className="bd-card-title">Upcoming occasions</h2>
                  <p className="bd-card-sub">Time your posts around the festive calendar</p>
                </div>
              </div>
              <div className="bd-list">
                {occasions.slice(0, 4).map((o) => (
                  <div key={o.name} className="bd-occ">
                    <span className="main">
                      <b>{o.name}</b>
                      <span>{o.days_away <= 0 ? "Today" : o.days_away === 1 ? "Tomorrow" : `In ${o.days_away} days`}</span>
                    </span>
                    <Link href="/images" className="bd-btn bd-btn-ghost bd-btn-sm">Create</Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bd-card bd-reveal">
            <div className="bd-card-head">
              <div>
                <h2 className="bd-card-title">Recent activity</h2>
                <p className="bd-card-sub">Your latest credit movements</p>
              </div>
              <Link href="/credits" className="bd-link">All <ArrowRight size={14} /></Link>
            </div>
            {loading ? (
              <div style={{ display: "grid", gap: 10 }}><Skel h={40} r={14} /><Skel h={40} r={14} /><Skel h={40} r={14} /></div>
            ) : txns.length === 0 ? (
              <div className="bd-empty"><strong>No activity yet</strong>Generate your first piece of content to see it here.</div>
            ) : (
              <div className="bd-list">
                {txns.map((t) => (
                  <div key={t.id} className="bd-row">
                    <span className="ico" style={{ background: t.amount >= 0 ? "var(--green-bg)" : "var(--bg)", color: t.amount >= 0 ? "var(--green)" : "var(--gray)" }}>
                      <Zap size={16} />
                    </span>
                    <span className="main">
                      <b>{TXN_LABEL[t.type] ?? t.type}</b>
                      <span>{timeAgo(t.createdAt)}</span>
                    </span>
                    <span className={"end " + (t.amount >= 0 ? "plus" : "minus")}>{t.amount >= 0 ? "+" : ""}{t.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bd-card bd-reveal" style={{ background: "var(--ink)", color: "#fff", border: 0 }}>
            <div className="bd-tip" style={{ color: "#c9c9cc" }}>
              <Lightbulb size={20} style={{ color: "#ffd166", flexShrink: 0, marginTop: 2 }} />
              <div>
                <b style={{ color: "#fff", display: "block", fontSize: 15, marginBottom: 4 }}>Pro tip</b>
                Press <kbd style={{ background: "#2b2b2c", borderColor: "#3a3a3c", color: "#fff" }}>G</kbd> then <kbd style={{ background: "#2b2b2c", borderColor: "#3a3a3c", color: "#fff" }}>D</kbd>, <kbd style={{ background: "#2b2b2c", borderColor: "#3a3a3c", color: "#fff" }}>C</kbd> or <kbd style={{ background: "#2b2b2c", borderColor: "#3a3a3c", color: "#fff" }}>I</kbd> to jump to the Dashboard, Calendar or Image Studio from anywhere.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
