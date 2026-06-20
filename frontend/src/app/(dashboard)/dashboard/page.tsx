"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { GenerationFlow } from "@/components/features/GenerationFlow";
import CountUp from "react-countup";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import {
  Zap,
  CalendarDays,
  CalendarCheck,
  Image,
  Video,
  ArrowRight,
  UploadCloud,
  X,
  Loader2,
  Sparkles,
  Camera,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useBrandStore } from "@/stores/brandStore";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import apiClient from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";

// ─── Trends types ──────────────────────────────────────────────────────────────

interface SparkPoint { day: string; value: number }
interface TrendsData {
  credits: SparkPoint[];
  content: SparkPoint[];
  calendar: SparkPoint[];
  images: SparkPoint[];
  weeklyContent: number;
  weeklyImages: number;
  imagesThisMonth: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PLAN_MAX = { FREE: 50, PRO: 500, BUSINESS: 2000 } as const;
type PlanKey = keyof typeof PLAN_MAX;

const WELCOME_KEY = "brandefai_welcome_dismissed";
const FIRST_CONTENT_KEY = "brandefai_first_content_ready";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
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
  accent: string;
  loading?: boolean;
  progress?: number;
  sparkData?: SparkPoint[];
  pulseGlow?: boolean;
}

function StatCard({
  label,
  value,
  sub,
  subAmber,
  icon: Icon,
  iconBg,
  iconColor,
  accent,
  loading,
  progress,
  sparkData,
  pulseGlow,
}: StatCardProps) {
  const points = sparkData ?? [];
  const isPositiveTrend =
    points.length < 2 ||
    points[points.length - 1].value >= points[0].value;
  const sparkColor = isPositiveTrend ? "#1A7A4A" : "#DC2626";

  return (
    <motion.div
      className="rounded-2xl"
      animate={
        pulseGlow
          ? {
              boxShadow: [
                "0 0 0 0px rgba(217,119,6,0)",
                "0 0 0 4px rgba(217,119,6,0.3)",
                "0 0 0 0px rgba(217,119,6,0)",
              ],
            }
          : { boxShadow: "none" }
      }
      transition={
        pulseGlow
          ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0 }
      }
    >
      <Card
        variant="stat"
        hoverable
        animate
        accent={accent}
        progress={progress}
        className="p-5"
      >
        {/* Icon — manually rendered so we can apply hover rotation */}
        <motion.div
          whileHover={{ rotate: 8 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className={cn(
            "absolute top-4 right-4 w-11 h-11 rounded-xl flex items-center justify-center",
            iconBg
          )}
        >
          <Icon size={18} className={iconColor} />
        </motion.div>

        <p className="text-xs font-medium text-gray-400 mb-2">{label}</p>

        {loading ? (
          <Skeleton className="h-8 w-16 mb-1" />
        ) : (
          <p className="text-3xl font-bold text-[#1A2E44] leading-none mb-1">
            <CountUp
              end={value}
              duration={1.5}
              separator=","
              enableScrollSpy
              scrollSpyOnce
            />
          </p>
        )}

        {sub && (
          <p
            className={cn(
              "text-xs mt-1",
              subAmber ? "text-amber-600 font-medium" : "text-gray-400"
            )}
          >
            {sub}
          </p>
        )}

        {/* Sparkline */}
        {points.length > 0 && !loading && (
          <div className="mt-3 -mx-1">
            <ResponsiveContainer width="100%" height={48}>
              <LineChart data={points}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparkColor}
                  dot={false}
                  strokeWidth={1.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
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
        isDragging
          ? "border-white/80 bg-white/20"
          : "border-white/30 bg-white/10 hover:bg-white/15"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !file && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {preview && file ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="h-28 w-auto mx-auto rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-gray-600 flex items-center justify-center shadow hover:text-red-500 transition-colors"
          >
            <X size={11} />
          </button>
          <p className="text-white/70 text-[11px] mt-2 truncate max-w-[160px] mx-auto">
            {file.name}
          </p>
        </div>
      ) : (
        <div className="py-4">
          <UploadCloud size={28} className="mx-auto text-white/60 mb-2" />
          <p className="text-white/80 text-xs font-medium">
            Drop product image here
          </p>
          <p className="text-white/50 text-[11px] mt-0.5">or click to browse</p>
        </div>
      )}
    </div>
  );
}

// ─── Welcome banner ────────────────────────────────────────────────────────────

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn(
          "w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 border-2",
          done ? "bg-[#1A7A4A] border-[#1A7A4A]" : "border-gray-200"
        )}
      >
        {done && (
          <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2">
            <path
              d="M1 4l2.8 2.8L9 1"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className={done ? "text-gray-700" : "text-gray-400"}>{label}</span>
    </div>
  );
}

function WelcomeBanner({
  brandName,
  strategyApproved,
  onDismiss,
}: {
  brandName: string;
  strategyApproved: boolean;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -64, opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 mb-6 flex items-start gap-4"
    >
      <div className="text-2xl leading-none mt-0.5">🎉</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#1A2E44] text-sm">
          Welcome to BranDeFAI, {brandName}!
        </p>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">
          Your account is set up. Here's your quick-start checklist.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          <CheckItem done label="Brand set up" />
          <CheckItem done={strategyApproved} label="Strategy approved" />
          <CheckItem done={false} label="Generate first content" />
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </motion.div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

// ─── Quick link card ────────────────────────────────────────────────────────────

function QuickLink({
  href,
  icon: Icon,
  iconBg,
  iconColor,
  title,
  desc,
}: {
  href: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow group"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#1A2E44] text-sm">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{desc}</p>
      </div>
      <ArrowRight
        size={16}
        className="text-gray-300 group-hover:text-[#1A7A4A] transition-colors shrink-0 mt-0.5"
      />
    </Link>
  );
}

// ─── Bulk product posts section ────────────────────────────────────────────────

interface BulkPendingFile { uid: string; file: File; preview: string }

type BulkPhase = "idle" | "uploading" | "analyzing" | "generating" | "done";

function BulkProductPostsSection() {
  const [pendingFiles, setPendingFiles] = useState<BulkPendingFile[]>([]);
  const [dragOver,     setDragOver]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase,      setPhase]      = useState<BulkPhase>("idle");
  const [doneImages, setDoneImages] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [finalCount, setFinalCount] = useState(0);
  const [errorMsg,   setErrorMsg]   = useState("");

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => { pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.preview)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(rawFiles: FileList | File[]) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const valid = Array.from(rawFiles).filter(
      (f) => allowed.includes(f.type) && f.size <= 10 * 1024 * 1024
    );
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
      // Step 1: Bulk upload
      setPhase("uploading");
      const formData = new FormData();
      pendingFiles.forEach((pf) => formData.append("images", pf.file));

      const uploadRes = await apiClient.post<{
        success: boolean;
        data: { images: Array<{ id: string }> };
        error: string | null;
      }>("/api/uploads/bulk-product-images", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!uploadRes.data.success || !uploadRes.data.data?.images?.length) {
        throw new Error(uploadRes.data.error ?? "Upload failed");
      }
      const productImageIds = uploadRes.data.data.images.map((i) => i.id);

      // Step 2: Generate post briefs
      setPhase("analyzing");
      const briefRes = await apiClient.post<{
        success: boolean;
        data: { briefs: Array<{ id: string }> };
        error: string | null;
      }>("/api/images/generate-post-briefs", { productImageIds });
      if (!briefRes.data.success || !briefRes.data.data?.briefs?.length) {
        throw new Error(briefRes.data.error ?? "Brief generation failed");
      }
      const briefs = briefRes.data.data.briefs;
      const total = briefs.length * 2;
      setTotalImages(total);
      setDoneImages(0);
      setPhase("generating");

      // Step 3: Generate 2 posts per brief sequentially with 3 s delay between each
      let generated = 0;
      for (const brief of briefs) {
        for (let img = 1; img <= 2; img++) {
          try {
            const postRes = await apiClient.post<{
              success: boolean;
              error: string | null;
            }>("/api/images/generate-product-posts", { briefId: brief.id });
            if (postRes.data.success) {
              generated += 1;
              setDoneImages(generated);
            }
          } catch {
            // partial failure — continue with remaining images
          }
          if (img < 2) await new Promise((r) => setTimeout(r, 3000));
        }
      }

      setFinalCount(generated);
      setPhase("done");
      pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
      setPendingFiles([]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setErrorMsg(e.response?.data?.error ?? e.message ?? "Something went wrong. Please try again.");
      setPhase("idle");
    }
  }, [pendingFiles, phase]);

  const isBusy = phase === "uploading" || phase === "analyzing" || phase === "generating";

  const phaseLabel: Record<BulkPhase, string> = {
    idle: "",
    uploading: "Uploading product images…",
    analyzing: "Analyzing products & generating briefs…",
    generating: `Generating posts… ${doneImages} of ${totalImages} complete`,
    done: "",
  };

  const progressPct = totalImages > 0 ? doneImages / totalImages : 0;

  if (phase === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#E8F5EE] flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} className="text-[#1A7A4A]" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[#1A2E44] text-sm">
              {finalCount} post{finalCount !== 1 ? "s" : ""} ready!
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Your promotional Instagram images have been saved to Image Studio.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Link
                href="/images"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A7A4A] hover:underline"
              >
                View in Image Studio <ExternalLink size={11} />
              </Link>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
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
      transition={{ duration: 0.35, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Camera size={16} className="text-purple-500" />
            </div>
            <h2 className="text-[15px] font-bold text-[#1A2E44]">Generate Product Posts</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Upload up to 15 product images — AI generates 2 promotional Instagram posts per product
            (1080×1350) with your brand aesthetic.
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold bg-purple-50 text-purple-500 border border-purple-100 rounded-full px-2.5 py-1">
          10 credits/product
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
      />

      {/* Pending files grid */}
      {pendingFiles.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {pendingFiles.map((pf) => (
              <div
                key={pf.uid}
                className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pf.preview} alt={pf.file.name} className="w-full h-full object-cover" />
                {!isBusy && (
                  <button
                    type="button"
                    onClick={() => removeFile(pf.uid)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={9} className="text-white" />
                  </button>
                )}
              </div>
            ))}
            {pendingFiles.length < 15 && !isBusy && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-lg hover:border-purple-300 hover:bg-purple-50/30 transition-colors font-light"
              >
                +
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">{pendingFiles.length}/15 images · {pendingFiles.length * 2} posts will be generated</p>
        </div>
      ) : (
        /* Drop zone */
        <div
          role="button"
          tabIndex={0}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !isBusy && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer select-none transition-all duration-150",
            dragOver
              ? "border-purple-400 bg-purple-50/60"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          )}
        >
          <UploadCloud size={28} className={cn("transition-colors", dragOver ? "text-purple-400" : "text-gray-300")} />
          <div className="text-center">
            <p className={cn("text-sm font-medium transition-colors", dragOver ? "text-purple-500" : "text-gray-500")}>
              Click to upload or drag &amp; drop
            </p>
            <p className="text-xs text-gray-300 mt-1">Up to 15 product images · JPEG · PNG · WebP · Max 10 MB each</p>
          </div>
        </div>
      )}

      {/* Progress bar (visible while generating) */}
      {isBusy && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-purple-500 shrink-0" />
            <p className="text-xs font-medium text-purple-600">{phaseLabel[phase]}</p>
          </div>
          {phase === "generating" && (
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-purple-500 rounded-full"
                animate={{ width: `${Math.max(4, progressPct * 100)}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
      )}

      {!isBusy && pendingFiles.length > 0 && (
        <button
          type="button"
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <Sparkles size={15} />
          Generate {pendingFiles.length * 2} Product Posts
        </button>
      )}
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const brand = useBrandStore((s) => s.brand);

  const [showBanner, setShowBanner] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [productImageId, setProductImageId] = useState<string | null>(null);

  function dismissBanner() {
    setShowBanner(false);
  }

  function handleFileSelect(f: File) {
    setUploadFile(f);
    setUploadPreview(URL.createObjectURL(f));
    setUploadError("");
  }

  function handleFileRemove() {
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadFile(null);
    setUploadPreview(null);
    setUploadError("");
  }

  function handleReset() {
    setProductImageId(null);
    setUploadFile(null);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(null);
    setUploadError("");
  }

  async function handleUploadAndGenerate() {
    if (!uploadFile || isUploading) return;
    setIsUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("image", uploadFile);
      const res = await apiClient.post<{ success: boolean; data: { productImageId: string } }>(
        "/api/uploads/product-image",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      if (res.data.success && res.data.data) {
        setProductImageId(res.data.data.productImageId);
      } else {
        setUploadError("Upload failed. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setUploadError(e.response?.data?.error ?? e.message ?? "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  // ── Static data (real fetching reconnected once loop is resolved) ─────────────
  const creditsBalance = 45;
  const contentCount   = 0;
  const calendarFilled = 0;
  const imagesCount    = 0;

  const max = PLAN_MAX[(user?.plan as PlanKey) ?? "FREE"] ?? 50;
  const isLowCredits = creditsBalance < max * 0.2;

  const creditsAccent  = isLowCredits ? "#D97706" : "#1A7A4A";
  const creditsIconBg  = isLowCredits ? "bg-amber-50" : "bg-[#E8F5EE]";
  const creditsIconCol = isLowCredits ? "text-amber-500" : "text-[#1A7A4A]";

  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1, 1);
  const resetsDate = nextReset.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const planLabel = (user?.plan ?? "FREE").charAt(0).toUpperCase() + (user?.plan ?? "FREE").slice(1).toLowerCase();
  const creditsSub = `${planLabel} plan · resets ${resetsDate}`;
  const contentSub = "No new content this week";
  const imagesThisMonth = 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Welcome banner ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBanner && brand && (
          <WelcomeBanner
            key="banner"
            brandName={brand.brandName}
            strategyApproved={brand.strategyApproved}
            onDismiss={dismissBanner}
          />
        )}
      </AnimatePresence>

      {/* ── Section 1: Welcome ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
      >
        <h1 className="text-2xl font-bold text-[#1A2E44]">
          {getGreeting()}, {brand?.brandName ?? user?.email?.split("@")[0]} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-1">{getFormattedDate()}</p>
      </motion.div>

      {/* ── Section 2: Stats ─────────────────────────────────────────────── */}
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
          iconBg={creditsIconBg}
          iconColor={creditsIconCol}
          accent={creditsAccent}
          progress={creditsBalance / max}
          pulseGlow={isLowCredits}
        />
        <StatCard
          label="Content Generated"
          value={contentCount}
          sub={contentSub}
          icon={Sparkles}
          iconBg="bg-purple-50"
          iconColor="text-[#7C3AED]"
          accent="#7C3AED"
        />
        <StatCard
          label="Calendar Days Filled"
          value={calendarFilled}
          sub={`${calendarFilled} of 30 days`}
          icon={CalendarCheck}
          iconBg="bg-blue-50"
          iconColor="text-[#2563EB]"
          accent="#2563EB"
          progress={calendarFilled / 30}
        />
        <StatCard
          label="Images Created"
          value={imagesCount}
          sub={`${imagesThisMonth} this month`}
          icon={Image}
          iconBg="bg-pink-50"
          iconColor="text-[#DB2777]"
          accent="#DB2777"
        />
      </motion.div>

      {/* ── Sections 3–5: Generate flow or default content ──────────────── */}
      {productImageId ? (
        <GenerationFlow productImageId={productImageId} onReset={handleReset} />
      ) : (
        <>
          {/* ── Section 3: Generate Content CTA ───────────────────────────── */}
          <motion.div
            id="generate-section"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12, ease: EASE_OUT }}
            className="rounded-2xl bg-gradient-to-br from-[#1A7A4A] to-[#0D5C38] p-6 text-white overflow-hidden relative"
          >
            {/* Decorative blob */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-8 right-20 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

            <div className="relative flex flex-col md:flex-row gap-6 items-start">
              {/* Left */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={18} className="text-white/80" />
                  <h2 className="text-lg font-bold">Generate This Month&apos;s Content</h2>
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-4">
                  Upload a product image and let AI create captions, reels,
                  ad copy &amp; images — ready to schedule instantly.
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 border border-white/20 rounded-full px-3 py-1">
                  <Zap size={11} />
                  20 credits per generation
                </span>

                {uploadError && (
                  <p className="text-white/80 text-xs mt-3 bg-white/10 rounded-lg px-3 py-2">
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Right — upload zone */}
              <div className="w-full md:w-64 flex-shrink-0 space-y-3">
                <UploadZone
                  file={uploadFile}
                  preview={uploadPreview}
                  onSelect={handleFileSelect}
                  onRemove={handleFileRemove}
                />

                <button
                  type="button"
                  disabled={!uploadFile || isUploading}
                  onClick={handleUploadAndGenerate}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 font-semibold rounded-xl py-3 text-sm transition-all",
                    uploadFile && !isUploading
                      ? "bg-white text-[#1A7A4A] hover:bg-white/90 shadow"
                      : "bg-white/20 text-white/50 cursor-not-allowed"
                  )}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      Generate Content
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          {/* ── Section 3b: Generate Product Posts ────────────────────────── */}
          <BulkProductPostsSection />

          {/* ── Section 4: Recent Generations ─────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.18, ease: EASE_OUT }}
          >
            <h2 className="text-base font-semibold text-[#1A2E44] mb-3">
              Recent Generations
            </h2>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <EmptyState
                variant="dashboard"
                onAction={() =>
                  document
                    .getElementById("generate-section")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
            </div>
          </motion.div>

          {/* ── Section 5: Quick Links ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.24, ease: EASE_OUT }}
          >
            <h2 className="text-base font-semibold text-[#1A2E44] mb-3">
              Quick Links
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <QuickLink
                href="/calendar"
                icon={CalendarDays}
                iconBg="bg-[#E8F5EE]"
                iconColor="text-[#1A7A4A]"
                title="Content Calendar"
                desc="View and manage your 30-day content schedule"
              />
              <QuickLink
                href="/images"
                icon={Image}
                iconBg="bg-purple-50"
                iconColor="text-purple-500"
                title="Image Studio"
                desc="Generate AI product images for your brand"
              />
              <QuickLink
                href="/videos"
                icon={Video}
                iconBg="bg-blue-50"
                iconColor="text-blue-500"
                title="Video Studio"
                desc="Create reels and video ads with AI"
              />
            </div>
          </motion.div>
        </>
      )}

    </div>
  );
}
