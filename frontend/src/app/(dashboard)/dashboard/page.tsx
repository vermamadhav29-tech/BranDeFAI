"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { GenerationFlow } from "@/components/features/GenerationFlow";
import CountUp from "react-countup";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import {
  Zap,
  CalendarCheck,
  Image,
  X,
  Loader2,
  Sparkles,
  Camera,
  CheckCircle2,
  ExternalLink,
  UploadCloud,
  ArrowRight,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useBrandStore } from "@/stores/brandStore";
import apiClient from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SparkPoint { day: string; value: number }

// ─── Constants ─────────────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PLAN_MAX = { FREE: 50, PRO: 500, BUSINESS: 2000 } as const;
type PlanKey = keyof typeof PLAN_MAX;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  subAmber?: boolean;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
  progress?: number;
  sparkData?: SparkPoint[];
  pulseGlow?: boolean;
}

function StatCard({ label, value, sub, subAmber, icon: Icon, iconBg, iconColor, loading, progress, sparkData, pulseGlow }: StatCardProps) {
  const points = sparkData ?? [];
  const isPositiveTrend = points.length < 2 || points[points.length - 1].value >= points[0].value;
  const sparkColor = isPositiveTrend ? "var(--accent-green)" : "#DC2626";

  return (
    <motion.div
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{
        background: "var(--stat-card-bg)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-card)",
      }}
      animate={pulseGlow ? { boxShadow: ["var(--shadow-card)", "0 0 0 4px rgba(245,158,11,0.25)", "var(--shadow-card)"] } : { boxShadow: "var(--shadow-card)" }}
      transition={pulseGlow ? { duration: 2, repeat: Infinity } : { duration: 0 }}
      whileHover={{ boxShadow: "var(--shadow-hover)", y: -2 }}
    >
      {/* Icon */}
      <motion.div
        whileHover={{ rotate: 8 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className={cn("absolute top-4 right-4 w-11 h-11 rounded-xl flex items-center justify-center", iconBg)}
      >
        <Icon size={18} className={iconColor} />
      </motion.div>

      <p className="text-[12px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>

      {loading ? (
        <Skeleton className="h-8 w-16 mb-1" />
      ) : (
        <p className="text-[32px] font-bold leading-none mb-1" style={{ color: "var(--text-primary)" }}>
          <CountUp end={value} duration={1.5} separator="," enableScrollSpy scrollSpyOnce />
        </p>
      )}

      {sub && (
        <p className={cn("text-[12px] mt-1", subAmber ? "text-amber-500 font-medium" : "")} style={subAmber ? undefined : { color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(4, progress * 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ background: subAmber ? "var(--accent-amber)" : "var(--primary)" }}
          />
        </div>
      )}

      {/* Sparkline */}
      {points.length > 0 && !loading && (
        <div className="mt-3 -mx-1">
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={points}>
              <Line type="monotone" dataKey="value" stroke={sparkColor} dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

// ─── Action card ───────────────────────────────────────────────────────────────

function ActionCard({
  href,
  icon,
  title,
  subtitle,
  gradientVar,
  titleVar,
  subtitleVar,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  gradientVar: string;
  titleVar: string;
  subtitleVar: string;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col justify-between rounded-[20px] p-6 overflow-hidden transition-all duration-200 group"
      style={{
        height: 156,
        background: `var(${gradientVar})`,
        border: "1px solid var(--border-color)",
      }}
    >
      {/* Content */}
      <div>
        <div className="text-[36px] leading-none mb-3">{icon}</div>
        <p className="font-bold text-[17px] leading-tight" style={{ color: `var(${titleVar})` }}>{title}</p>
        <p className="text-[13px] mt-1" style={{ color: `var(${subtitleVar})` }}>{subtitle}</p>
      </div>

      {/* Arrow */}
      <ArrowRight
        size={20}
        className="absolute bottom-4 right-4 opacity-30 group-hover:opacity-70 group-hover:translate-x-1 transition-all"
        style={{ color: `var(${titleVar})` }}
      />

      {/* Hover lift */}
      <motion.div
        className="absolute inset-0 rounded-[20px] pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        style={{ background: "rgba(255,255,255,0.04)" }}
      />
    </Link>
  );
}

// ─── Upload zone ───────────────────────────────────────────────────────────────

interface UploadZoneProps {
  file: File | null;
  preview: string | null;
  onSelect: (f: File) => void;
  onRemove: () => void;
}

function UploadZone({ file, preview, onSelect, onRemove }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onSelect(f);
  }

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-dashed transition-colors p-4 text-center cursor-pointer",
        isDragging ? "border-white/80 bg-white/20" : "border-white/30 bg-white/10 hover:bg-white/15"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => !file && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {preview && file ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="h-28 w-auto mx-auto rounded-lg object-cover" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-gray-600 flex items-center justify-center shadow hover:text-red-500 transition-colors"
          >
            <X size={11} />
          </button>
          <p className="text-white/70 text-[11px] mt-2 truncate max-w-[160px] mx-auto">{file.name}</p>
        </div>
      ) : (
        <div className="py-4">
          <UploadCloud size={28} className="mx-auto text-white/60 mb-2" />
          <p className="text-white/80 text-xs font-medium">Drop product image here</p>
          <p className="text-white/50 text-[11px] mt-0.5">or click to browse</p>
        </div>
      )}
    </div>
  );
}

// ─── Bulk product posts section ────────────────────────────────────────────────

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
    idle: "", uploading: "Uploading product images…", analyzing: "Analyzing products & generating briefs…",
    generating: `Generating posts… ${doneImages} of ${totalImages} complete`, done: "",
  };

  if (phase === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.12)" }}>
            <CheckCircle2 size={20} style={{ color: "var(--accent-green)" }} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              {finalCount} post{finalCount !== 1 ? "s" : ""} ready!
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Your promotional Instagram images have been saved to Image Studio.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Link href="/images" className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline" style={{ color: "var(--primary)" }}>
                View in Image Studio <ExternalLink size={11} />
              </Link>
              <button type="button" onClick={reset} className="text-xs transition-colors" style={{ color: "var(--text-muted)" }}>
                Generate more
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.14, ease: EASE_OUT }}
      className="rounded-2xl p-6 space-y-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.12)" }}>
              <Camera size={16} style={{ color: "var(--accent-purple)" }} />
            </div>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Generate Product Posts</h2>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Upload up to 15 product images — AI generates 2 promotional Instagram posts per product (1080×1350) with your brand aesthetic.
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold rounded-full px-2.5 py-1" style={{ background: "rgba(139,92,246,0.1)", color: "var(--accent-purple)", border: "1px solid rgba(139,92,246,0.2)" }}>
          10 credits/product
        </span>
      </div>

      <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); }} />

      {pendingFiles.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {pendingFiles.map((pf) => (
              <div key={pf.uid} className="relative group aspect-square rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pf.preview} alt={pf.file.name} className="w-full h-full object-cover" />
                {!isBusy && (
                  <button type="button" onClick={() => removeFile(pf.uid)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={9} className="text-white" />
                  </button>
                )}
              </div>
            ))}
            {pendingFiles.length < 15 && !isBusy && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-lg font-light transition-all hover:opacity-70" style={{ borderColor: "var(--border-hover)", color: "var(--text-muted)" }}>
                +
              </button>
            )}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pendingFiles.length}/15 images · {pendingFiles.length * 2} posts will be generated</p>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !isBusy && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          className="flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer select-none transition-all"
          style={{
            borderColor: dragOver ? "var(--accent-purple)" : "var(--border-color)",
            background: dragOver ? "rgba(139,92,246,0.06)" : "transparent",
          }}
        >
          <UploadCloud size={28} style={{ color: dragOver ? "var(--accent-purple)" : "var(--text-muted)" }} />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: dragOver ? "var(--accent-purple)" : "var(--text-secondary)" }}>
              Click to upload or drag &amp; drop
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Up to 15 product images · JPEG · PNG · WebP · Max 10 MB each</p>
          </div>
        </div>
      )}

      {isBusy && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin shrink-0" style={{ color: "var(--accent-purple)" }} />
            <p className="text-xs font-medium" style={{ color: "var(--accent-purple)" }}>{phaseLabel[phase]}</p>
          </div>
          {phase === "generating" && (
            <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "var(--border-color)" }}>
              <motion.div className="h-full rounded-full" animate={{ width: `${Math.max(4, progressPct * 100)}%` }} transition={{ duration: 0.4 }} style={{ background: "var(--accent-purple)" }} />
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
      )}

      {!isBusy && pendingFiles.length > 0 && (
        <button type="button" onClick={handleGenerate} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-all" style={{ background: "var(--accent-purple)" }}>
          <Sparkles size={15} />
          Generate {pendingFiles.length * 2} Product Posts
        </button>
      )}
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user  = useAuthStore((s) => s.user);
  const brand = useBrandStore((s) => s.brand);

  const [uploadFile,    setUploadFile]    = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploading,   setIsUploading]   = useState(false);
  const [uploadError,   setUploadError]   = useState("");
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

  // Static data (real fetching reconnected once loop is resolved)
  const creditsBalance = user?.creditsBalance ?? 45;
  const contentCount   = 0;
  const calendarFilled = 0;
  const imagesCount    = 0;

  const max          = PLAN_MAX[(user?.plan as PlanKey) ?? "FREE"] ?? 50;
  const isLowCredits = creditsBalance < max * 0.2;
  const nextReset    = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1, 1);
  const resetsDate  = nextReset.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const planLabel   = (user?.plan ?? "FREE").charAt(0).toUpperCase() + (user?.plan ?? "FREE").slice(1).toLowerCase();
  const creditsSub  = `${planLabel} plan · resets ${resetsDate}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-6">

      {productImageId ? (
        <GenerationFlow productImageId={productImageId} onReset={handleReset} />
      ) : (
        <>
          {/* ── Section 1: Welcome ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="flex items-start justify-between"
          >
            <div>
              <h1 className="text-[26px] font-bold" style={{ color: "var(--text-primary)" }}>
                {getGreeting()}, {brand?.brandName ?? user?.email?.split("@")[0]} 👋
              </h1>
              <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>{getFormattedDate()}</p>
            </div>
          </motion.div>

          {/* ── Section 2: Stat Cards ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06, ease: EASE_OUT }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <StatCard
              label="Credits Remaining"
              value={creditsBalance}
              sub={creditsSub}
              subAmber={isLowCredits}
              icon={Zap}
              iconBg={isLowCredits ? "bg-amber-50" : ""}
              iconColor={isLowCredits ? "text-amber-500" : ""}
              progress={creditsBalance / max}
              pulseGlow={isLowCredits}
            />
            <StatCard
              label="Content Generated"
              value={contentCount}
              sub="No new content this week"
              icon={Sparkles}
              iconBg="bg-purple-50"
              iconColor="text-[var(--accent-purple)]"
            />
            <StatCard
              label="Calendar Days Filled"
              value={calendarFilled}
              sub={`${calendarFilled} of 30 days`}
              icon={CalendarCheck}
              iconBg="bg-sky-50"
              iconColor="text-sky-500"
              progress={calendarFilled / 30}
            />
            <StatCard
              label="Images Created"
              value={imagesCount}
              sub="0 this month"
              icon={Image}
              iconBg="bg-pink-50"
              iconColor="text-pink-500"
            />
          </motion.div>

          {/* ── Section 3: Action Cards ────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: EASE_OUT }}
          >
            <p className="text-[14px] font-semibold uppercase tracking-[0.05em] mb-4" style={{ color: "var(--text-muted)" }}>
              What do you want to create today?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ActionCard
                href="/content"
                icon="✍️"
                title="Write a Post"
                subtitle="Caption + hashtags"
                gradientVar="--card-post-gradient"
                titleVar="--card-post-title"
                subtitleVar="--card-post-sub"
              />
              <ActionCard
                href="/images"
                icon="🖼️"
                title="Make an Image"
                subtitle="Product photo or promo creative"
                gradientVar="--card-image-gradient"
                titleVar="--card-image-title"
                subtitleVar="--card-image-sub"
              />
              <ActionCard
                href="/calendar"
                icon="📅"
                title="Plan My Month"
                subtitle="30 days of content ideas"
                gradientVar="--card-plan-gradient"
                titleVar="--card-plan-title"
                subtitleVar="--card-plan-sub"
              />
            </div>
          </motion.div>

          {/* ── Section 3b: Generate Product Posts ────────────────────────── */}
          <BulkProductPostsSection />

          {/* ── Section 4: Recent Content ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.18, ease: EASE_OUT }}
          >
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
              Recent Content
            </h2>

            {/* Empty state */}
            <div
              className="rounded-2xl p-10 text-center"
              style={{
                border: "2px dashed var(--border-color)",
              }}
            >
              <p className="text-[15px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>✨ No content yet</p>
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                Create your first post using the cards above
              </p>
            </div>
          </motion.div>
        </>
      )}

    </div>
  );
}
