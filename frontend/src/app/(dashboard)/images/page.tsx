"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Download,
  Trash2,
  Image as ImageIcon,
  Check,
  X,
  Camera,
  UploadCloud,
  FileText,
  ChevronDown,
  CalendarPlus,
  Zap,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useBrandStore } from "@/stores/brandStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { ImageCardSkeleton } from "@/components/ui/Skeleton";
import type { Brand } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeneratedImage {
  id: string;
  imageUrl: string;
  originalPrompt: string;
  style: string;
  format: string;
  createdAt: string;
}

interface PendingFile {
  uid: string;
  file: File;
  preview: string;
}

interface UploadedProductImage {
  id: string;
  imageUrl: string;
  filename: string;
}

interface PostBriefData {
  postTitle: string;
  postConcept: string;
  visualBrief: string;
  textOverlay: string;
  ctaText: string;
  caption: string;
}

interface BriefWithImage {
  id: string;
  productImageId: string;
  imageUrl: string;
  briefJson: PostBriefData;
  createdAt: string;
  generatedImages: Array<{ id: string; imageUrl: string }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const STYLES = [
  { id: "photorealistic", emoji: "📸", label: "Photorealistic" },
  { id: "illustrated",    emoji: "🎨", label: "Illustrated"    },
  { id: "minimal",        emoji: "⬜", label: "Minimal"        },
  { id: "vibrant",        emoji: "🌈", label: "Vibrant"        },
  { id: "cinematic",      emoji: "🎬", label: "Cinematic"      },
] as const;

type StyleId = typeof STYLES[number]["id"];

const FORMATS = [
  { id: "4:5",  label: "Instagram Post", sublabel: "1080×1350", w: 4, h: 5 },
  { id: "1:1",  label: "Square",         sublabel: "Feed Post", w: 5, h: 5 },
  { id: "16:9", label: "Landscape",      sublabel: "Banner",    w: 8, h: 5 },
] as const;

type FormatId = typeof FORMATS[number]["id"];

const FORMAT_LABELS: Record<string, string> = {
  "1:1": "Square",
  "4:5": "Instagram Post",
  "16:9": "Landscape",
};

const MAX_CHARS = 500;

// ─── FormatPreview ────────────────────────────────────────────────────────────

function FormatPreview({ w, h, active }: { w: number; h: number; active: boolean }) {
  return (
    <div
      className={cn(
        "rounded border-2 transition-colors duration-150 shrink-0",
        active ? "border-[#1A7A4A] bg-[#1A7A4A]/20" : "border-gray-300 bg-gray-100"
      )}
      style={{ width: `${w * 4}px`, height: `${h * 4}px` }}
    />
  );
}


// ─── CalendarModal ────────────────────────────────────────────────────────────

function CalendarModal({
  imageId,
  onClose,
  onAdded,
}: {
  imageId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const now = new Date();
  const [day, setDay] = useState(now.getDate());
  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await apiClient.post("/api/calendar/entry", {
        calendarDay: day,
        month,
        year,
        contentType: "IMAGE",
        contentId: imageId,
      });
      onAdded();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Failed to add to calendar.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className="bg-white rounded-2xl shadow-xl p-6 w-72 mx-4"
      >
        <h3 className="text-sm font-bold text-[#1A2E44] mb-1">Add to Calendar</h3>
        <p className="text-xs text-gray-400 mb-4">
          Schedule this image for {new Date(year, month - 1, 1).toLocaleString("en", { month: "long" })} {year}
        </p>
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Day (1–31)</label>
        <input
          type="number"
          min={1}
          max={31}
          value={day}
          onChange={(e) => setDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
          className="mt-1.5 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-[#1A2E44] focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/25 focus:border-[#1A7A4A]"
        />
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#1A7A4A] hover:bg-[#145C38] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />}
            {saving ? "Saving…" : "Schedule"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── ImageCard ────────────────────────────────────────────────────────────────

function ImageCard({
  image,
  onDelete,
  onShowToast,
}: {
  image: GeneratedImage;
  onDelete: (id: string) => void;
  onShowToast: (msg: string) => void;
}) {
  const [downloading,   setDownloading]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [calendarOpen,  setCalendarOpen]  = useState(false);

  const aspectStyle: React.CSSProperties = {
    aspectRatio:
      image.format === "16:9" ? "16 / 9"
      : image.format === "4:5" ? "4 / 5"
      : "1 / 1",
  };

  async function handleDownload() {
    setDownloading(true);
    try {
      const res  = await fetch(image.imageUrl);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `brandefai-${image.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiClient.delete(`/api/images/${image.id}`);
      onDelete(image.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      {calendarOpen && (
        <CalendarModal
          imageId={image.id}
          onClose={() => setCalendarOpen(false)}
          onAdded={() => onShowToast("Added to calendar!")}
        />
      )}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm group"
      >
        <div className="relative overflow-hidden bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.imageUrl}
            alt={image.originalPrompt}
            className="w-full object-cover"
            style={aspectStyle}
            loading="lazy"
          />

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              title="Download"
              className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-md"
            >
              {downloading
                ? <Loader2 size={15} className="text-gray-600 animate-spin" />
                : <Download size={15} className="text-gray-700" />
              }
            </button>

            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              title="Add to Calendar"
              className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-md"
            >
              <CalendarPlus size={15} className="text-gray-700" />
            </button>

            {confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-9 px-3 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-red-600 transition-colors shadow-md"
                >
                  {deleting
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />
                  }
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-md"
                  title="Cancel"
                >
                  <X size={15} className="text-gray-700" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                title="Delete"
                className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-md"
              >
                <Trash2 size={15} className="text-gray-700" />
              </button>
            )}
          </div>
        </div>

        <div className="px-3 py-2.5 flex items-center gap-2">
          <p className="text-xs text-gray-500 truncate flex-1 min-w-0" title={image.originalPrompt}>
            {image.originalPrompt}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
              {FORMAT_LABELS[image.format] ?? image.format}
            </span>
            <span className="text-[10px] bg-[#E8F5EE] text-[#1A7A4A] rounded-full px-2 py-0.5 capitalize">
              {image.style}
            </span>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── BriefCard ────────────────────────────────────────────────────────────────

function BriefCard({
  brief,
  onUseAsPrompt,
  onPostsGenerated,
  onShowToast,
}: {
  brief: BriefWithImage;
  onUseAsPrompt: (visualBrief: string) => void;
  onPostsGenerated: (images: Array<{ id: string; imageUrl: string }>) => void;
  onShowToast: (msg: string) => void;
}) {
  const [captionOpen, setCaptionOpen] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Array<{ id: string; imageUrl: string }>>(
    brief.generatedImages ?? []
  );
  const [genProgress, setGenProgress] = useState("");
  const [generating, setGenerating] = useState(false);
  const [calendarImageId, setCalendarImageId] = useState<string | null>(null);

  async function handleGenerate2Posts() {
    if (generating) return;
    setGenerating(true);
    const newImages: Array<{ id: string; imageUrl: string }> = [];

    try {
      for (let i = 1; i <= 2; i++) {
        setGenProgress(`Generating post ${i} of 2…`);
        const res = await apiClient.post<{
          success: boolean;
          data: { image: { imageId: string; imageUrl: string } };
          error: string | null;
        }>("/api/images/generate-product-posts", { briefId: brief.id });

        if (res.data.success && res.data.data?.image) {
          const img = { id: res.data.data.image.imageId, imageUrl: res.data.data.image.imageUrl };
          newImages.push(img);
          setGeneratedImages((prev) => [...prev, img]);
        } else {
          onShowToast(`Post ${i} generation failed.`);
          break;
        }

        if (i < 2) await new Promise((r) => setTimeout(r, 3000));
      }

      if (newImages.length > 0) {
        onPostsGenerated(newImages);
        onShowToast(`${newImages.length} post${newImages.length > 1 ? "s" : ""} generated!`);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      onShowToast(e.response?.data?.error ?? e.message ?? "Generation failed.");
    } finally {
      setGenerating(false);
      setGenProgress("");
    }
  }

  const hasGenerated = generatedImages.length > 0;

  return (
    <>
      {calendarImageId && (
        <CalendarModal
          imageId={calendarImageId}
          onClose={() => setCalendarImageId(null)}
          onAdded={() => onShowToast("Added to calendar!")}
        />
      )}

      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        {/* Product thumbnail */}
        <div className="relative h-36 bg-gray-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brief.imageUrl}
            alt={brief.briefJson.postTitle}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          <p className="absolute bottom-2.5 left-3 right-3 text-white text-xs font-bold leading-tight line-clamp-2">
            {brief.briefJson.postTitle}
          </p>
        </div>

        <div className="p-4 space-y-3">
          {/* Post concept */}
          <p className="text-xs text-gray-600 leading-relaxed">{brief.briefJson.postConcept}</p>

          {/* Visual brief */}
          <div className="bg-[#F8FAFB] rounded-xl px-3 py-2.5 border border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Visual Brief
            </p>
            <p className="text-xs text-gray-500 leading-relaxed italic">
              {brief.briefJson.visualBrief}
            </p>
          </div>

          {/* Text overlay + CTA */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Text Overlay
              </p>
              <p className="text-xs font-semibold text-[#1A2E44]">
                &ldquo;{brief.briefJson.textOverlay}&rdquo;
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold text-[#1A7A4A] bg-[#E8F5EE] px-2.5 py-1 rounded-full whitespace-nowrap">
              {brief.briefJson.ctaText}
            </span>
          </div>

          {/* Caption — collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setCaptionOpen((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-500 transition-colors"
            >
              Caption
              <ChevronDown
                size={11}
                className={cn(
                  "transition-transform duration-200",
                  captionOpen && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {captionOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="overflow-hidden mt-1.5"
                >
                  <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg px-3 py-2.5">
                    {brief.briefJson.caption}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Generated post images */}
          {hasGenerated && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Generated Posts
              </p>
              <div className="grid grid-cols-2 gap-2">
                {generatedImages.map((img) => (
                  <div key={img.id} className="relative group rounded-xl overflow-hidden aspect-[4/5] bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.imageUrl}
                      alt="Generated promotional post"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                      <a
                        href={img.imageUrl}
                        download={`post-${img.id}.jpg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow"
                        title="Download"
                      >
                        <Download size={13} className="text-gray-700" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setCalendarImageId(img.id)}
                        className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow"
                        title="Add to Calendar"
                      >
                        <CalendarPlus size={13} className="text-gray-700" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {generating ? (
            <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#E8F5EE]">
              <Loader2 size={14} className="animate-spin text-[#1A7A4A]" />
              <span className="text-xs font-medium text-[#1A7A4A]">{genProgress}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGenerate2Posts}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1A7A4A] hover:bg-[#145C38] text-white text-xs font-semibold transition-colors"
              >
                <Zap size={12} />
                {hasGenerated ? "Regenerate 2 Posts" : "Generate 2 Posts"}
                <span className="text-white/60 font-normal">· 10 credits</span>
              </button>
              <button
                type="button"
                onClick={() => onUseAsPrompt(brief.briefJson.visualBrief)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-medium transition-colors"
              >
                <Sparkles size={12} />
                Customize in Studio
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImagesPage() {
  const user          = useAuthStore((s) => s.user);
  const updateCredits = useAuthStore((s) => s.updateCredits);
  const storedBrand   = useBrandStore((s) => s.brand);
  const setBrandStore = useBrandStore((s) => s.setBrand);

  const [brand,      setBrand]      = useState<Brand | null>(storedBrand);

  // Form
  const [prompt,     setPrompt]     = useState("");
  const [style,      setStyle]      = useState<StyleId>("photorealistic");
  const [format,     setFormat]     = useState<FormatId>("4:5");
  const [brandCtx,   setBrandCtx]   = useState(true);

  // Reference image upload
  const [refImageUrl,    setRefImageUrl]    = useState<string | null>(null);
  const [refProductName, setRefProductName] = useState<string | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);
  const [dragOver,       setDragOver]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Logo compositing toggle
  const [includeLogo, setIncludeLogo] = useState(false);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState<string | null>(null);

  // Gallery
  const [images,      setImages]      = useState<GeneratedImage[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [galleryReady, setGalleryReady] = useState(false);

  // Right-panel tabs
  const [activePanel, setActivePanel] = useState<"images" | "briefs">("images");

  // Bulk upload state
  const [pendingFiles,     setPendingFiles]     = useState<PendingFile[]>([]);
  const [bulkDragOver,     setBulkDragOver]     = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploading,    setBulkUploading]    = useState(false);
  const [generatingBriefs, setGeneratingBriefs] = useState(false);
  const [briefProgress,    setBriefProgress]    = useState("");

  // Briefs
  const [briefs,       setBriefs]       = useState<BriefWithImage[]>([]);
  const [briefsLoaded, setBriefsLoaded] = useState(false);

  function showToast(msg: string) { toast.success(msg); }

  // Load brand
  useEffect(() => {
    const b = storedBrand;
    if (b) {
      setBrand(b);
      if (b.logoUrl) setIncludeLogo(true);
      return;
    }
    apiClient
      .get<{ success: boolean; data: Brand }>("/api/brand")
      .then((res) => {
        if (res.data.success && res.data.data) {
          setBrand(res.data.data);
          setBrandStore(res.data.data);
          if (res.data.data.logoUrl) setIncludeLogo(true);
        }
      })
      .catch(() => {});
  }, [storedBrand, setBrandStore]);

  // Initial gallery load
  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: { items: GeneratedImage[]; total: number } }>("/api/images?page=1")
      .then((res) => {
        if (res.data.success && res.data.data) {
          setImages(res.data.data.items);
          setTotal(res.data.data.total);
        }
      })
      .finally(() => setGalleryReady(true));
  }, []);

  // Load existing post briefs
  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: { briefs: BriefWithImage[] } }>("/api/images/post-briefs")
      .then((res) => {
        if (res.data.success && res.data.data) setBriefs(res.data.data.briefs);
      })
      .finally(() => setBriefsLoaded(true));
  }, []);

  // Revoke preview object URLs on unmount
  useEffect(() => {
    return () => { pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.preview)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: { items: GeneratedImage[]; total: number } }>(
        `/api/images?page=${nextPage}`
      );
      if (res.data.success && res.data.data) {
        setImages((prev) => [...prev, ...res.data.data.items]);
        setTotal(res.data.data.total);
        setPage(nextPage);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [page]);

  const handleUpload = useCallback(async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only JPEG, PNG, and WebP files are accepted.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File must be 10 MB or smaller.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setRefImageUrl(null);
    setRefProductName(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await apiClient.post<{
        success: boolean;
        data: { imageUrl: string; visionAnalysis: { productName?: string } | null };
        error: string | null;
      }>("/api/uploads/product-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success && res.data.data) {
        setRefImageUrl(res.data.data.imageUrl);
        setRefProductName(res.data.data.visionAnalysis?.productName ?? null);
      } else {
        setUploadError(res.data.error ?? "Upload failed. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setUploadError(e.response?.data?.error ?? e.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  function clearReference() {
    setRefImageUrl(null);
    setRefProductName(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { imageId: string; imageUrl: string };
        error: string | null;
      }>("/api/images/generate", {
        prompt: prompt.trim(),
        style,
        format,
        ...(refImageUrl ? { referenceImageUrl: refImageUrl } : {}),
        includeLogo: includeLogo && !!brand?.logoUrl,
      });

      if (res.data.success && res.data.data) {
        const { imageId, imageUrl } = res.data.data;
        const newImg: GeneratedImage = {
          id: imageId,
          imageUrl,
          originalPrompt: prompt.trim(),
          style,
          format,
          createdAt: new Date().toISOString(),
        };
        setImages((prev) => [newImg, ...prev]);
        setTotal((prev) => prev + 1);
        if (user) updateCredits(Math.max(0, user.creditsBalance - 5));
        showToast("Image generated successfully!");
      } else {
        setGenError(res.data.error ?? "Generation failed. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setGenError(e.response?.data?.error ?? e.message ?? "Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, style, format, refImageUrl, generating, user, updateCredits, includeLogo, brand]);

  const handleDelete = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
    showToast("Image deleted.");
  }, []);

  // ─── Bulk upload handlers ───────────────────────────────────────────────────

  function handleBulkFileAdd(rawFiles: FileList | File[]) {
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

  function removePendingFile(uid: string) {
    setPendingFiles((prev) => {
      const removed = prev.find((pf) => pf.uid === uid);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((pf) => pf.uid !== uid);
    });
  }

  async function handleUploadAndGenerate() {
    if (!pendingFiles.length || bulkUploading || generatingBriefs) return;

    setBulkUploading(true);
    setBriefProgress("Uploading images…");

    try {
      const formData = new FormData();
      pendingFiles.forEach((pf) => formData.append("images", pf.file));

      const uploadRes = await apiClient.post<{
        success: boolean;
        data: { images: UploadedProductImage[] };
        error: string | null;
      }>("/api/uploads/bulk-product-images", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!uploadRes.data.success || !uploadRes.data.data?.images?.length) {
        showToast("Upload failed. Please try again.");
        return;
      }

      const uploaded = uploadRes.data.data.images;
      setBulkUploading(false);
      setGeneratingBriefs(true);
      setBriefProgress(
        `Generating post ideas for ${uploaded.length} image${uploaded.length > 1 ? "s" : ""}…`
      );

      const briefRes = await apiClient.post<{
        success: boolean;
        data: { briefs: BriefWithImage[] };
        error: string | null;
      }>("/api/images/generate-post-briefs", {
        productImageIds: uploaded.map((i) => i.id),
      });

      if (briefRes.data.success && briefRes.data.data?.briefs?.length) {
        const newBriefs = briefRes.data.data.briefs;
        setBriefs((prev) => [...newBriefs, ...prev]);
        setPendingFiles([]);
        showToast(`${newBriefs.length} post brief${newBriefs.length > 1 ? "s" : ""} ready!`);
      } else {
        showToast("Brief generation failed. Please try again.");
      }
    } catch {
      showToast("Something went wrong. Please try again.");
    } finally {
      setBulkUploading(false);
      setGeneratingBriefs(false);
      setBriefProgress("");
    }
  }

  function handleUseAsPrompt(visualBrief: string) {
    setPrompt(visualBrief);
    setActivePanel("images");
  }

  function handlePostsGenerated(newImages: Array<{ id: string; imageUrl: string }>) {
    const asGalleryItems: GeneratedImage[] = newImages.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      originalPrompt: "Promotional post",
      style: "photorealistic",
      format: "4:5",
      createdAt: new Date().toISOString(),
    }));
    setImages((prev) => [...asGalleryItems, ...prev]);
    setTotal((prev) => prev + asGalleryItems.length);
    if (user) updateCredits(Math.max(0, user.creditsBalance - 5 * newImages.length));
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const canGenerate  = prompt.trim().length > 0 && !generating;
  const hasMore      = images.length < total;
  const isBulkBusy   = bulkUploading || generatingBriefs;
  const brandPreview = brand
    ? `${brand.tone} style, targeting ${brand.targetAudience}`
    : null;

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ════════════════════════ LEFT PANEL ══════════════════════════════ */}
        <div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

            <div>
              <h1 className="text-[17px] font-bold text-[#1A2E44]">Image Studio</h1>
              <p className="text-xs text-gray-400 mt-0.5">Generate professional marketing visuals</p>
            </div>

            {/* ── Prompt textarea ─────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Describe your image
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, MAX_CHARS))}
                rows={4}
                placeholder="A sleek product shot on a marble surface, soft natural light..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-[#1A2E44] placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/25 focus:border-[#1A7A4A] transition-colors leading-relaxed"
              />
              <p className={cn(
                "text-right text-[11px] tabular-nums transition-colors",
                prompt.length > MAX_CHARS * 0.9 ? "text-amber-500" : "text-gray-300"
              )}>
                {prompt.length}/{MAX_CHARS}
              </p>
            </div>

            {/* ── Reference photo upload ──────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Reference Photo
                </label>
                <span className="text-[10px] text-gray-300 font-medium">Optional</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />

              {refImageUrl ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#1A7A4A]/40 bg-[#E8F5EE]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={refImageUrl}
                    alt="Reference"
                    className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#1A7A4A]/20"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#1A2E44] truncate">
                      {refProductName ?? "Reference photo"}
                    </p>
                    <p className="text-[11px] text-[#1A7A4A] mt-0.5 flex items-center gap-1">
                      <Check size={11} />
                      Analyzed · ready to use
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearReference}
                    className="shrink-0 w-6 h-6 rounded-full bg-white/70 hover:bg-white flex items-center justify-center transition-colors"
                    title="Remove reference photo"
                  >
                    <X size={13} className="text-gray-500" />
                  </button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !uploading && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleUpload(file);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer select-none",
                    uploading
                      ? "border-[#1A7A4A]/40 bg-[#E8F5EE]/50 cursor-default"
                      : dragOver
                        ? "border-[#1A7A4A] bg-[#E8F5EE]/60"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={22} className="text-[#1A7A4A] animate-spin" />
                      <p className="text-xs text-[#1A7A4A] font-medium">Analyzing photo…</p>
                    </>
                  ) : (
                    <>
                      <Camera size={22} className={cn("transition-colors", dragOver ? "text-[#1A7A4A]" : "text-gray-300")} />
                      <div className="text-center">
                        <p className={cn("text-xs font-medium transition-colors", dragOver ? "text-[#1A7A4A]" : "text-gray-500")}>
                          Click to upload or drag &amp; drop
                        </p>
                        <p className="text-[11px] text-gray-300 mt-0.5">JPEG · PNG · WebP · Max 10 MB</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              <AnimatePresence>
                {uploadError && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-red-500 overflow-hidden"
                  >
                    {uploadError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* ── Brand context toggle ─────────────────────────────────────── */}
            {brand && brandPreview && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setBrandCtx((v) => !v)}
                  className="w-full flex items-center justify-between gap-3"
                >
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-left">
                    Add brand context automatically
                  </span>
                  <div
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0",
                      brandCtx ? "bg-[#1A7A4A]" : "bg-gray-200"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
                        brandCtx ? "left-[18px]" : "left-0.5"
                      )}
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {brandCtx && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <p className="text-[11px] text-[#1A7A4A] bg-[#E8F5EE] rounded-lg px-3 py-2 leading-relaxed">
                        <span className="font-semibold">AI will add:</span>{" "}
                        {brandPreview}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── Include brand logo toggle ────────────────────────────────── */}
            {brand?.logoUrl && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIncludeLogo((v) => !v)}
                  className="w-full flex items-center justify-between gap-3"
                >
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-left">
                    Include brand logo
                  </span>
                  <div
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0",
                      includeLogo ? "bg-[#1A7A4A]" : "bg-gray-200"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
                        includeLogo ? "left-[18px]" : "left-0.5"
                      )}
                    />
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {includeLogo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2.5 text-[11px] text-[#1A7A4A] bg-[#E8F5EE] rounded-lg px-3 py-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={brand.logoUrl}
                          alt="Brand logo"
                          className="w-5 h-5 object-contain shrink-0"
                        />
                        Logo composited bottom-right at 11% width
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── Style selector ───────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Visual Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s, i) => {
                  const isLast   = i === STYLES.length - 1;
                  const isActive = style === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150",
                        isLast && "col-span-2 justify-center",
                        isActive
                          ? "border-[#1A7A4A] bg-[#E8F5EE] text-[#1A7A4A]"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <span className="text-base leading-none">{s.emoji}</span>
                      <span>{s.label}</span>
                      {isActive && !isLast && (
                        <Check size={13} className="ml-auto text-[#1A7A4A]" />
                      )}
                      {isActive && isLast && (
                        <Check size={13} className="text-[#1A7A4A]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Aspect ratio selector ────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((f) => {
                  const isActive = format === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormat(f.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 px-2 py-3 rounded-xl border text-xs font-medium transition-all duration-150",
                        isActive
                          ? "border-[#1A7A4A] bg-[#E8F5EE] text-[#1A7A4A]"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <FormatPreview w={f.w} h={f.h} active={isActive} />
                      <div className="text-center leading-tight">
                        <div className="font-semibold">{f.label}</div>
                        <div className="text-[10px] opacity-60">{f.sublabel}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Generate button ──────────────────────────────────────────── */}
            <div className="space-y-2 pt-1">
              <AnimatePresence>
                {genError && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 overflow-hidden"
                  >
                    {genError}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
                  canGenerate
                    ? "bg-[#1A7A4A] text-white hover:bg-[#145C38] shadow-sm hover:shadow-md"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate Image
                    <span className={cn(
                      "text-xs font-normal ml-0.5",
                      canGenerate ? "text-white/60" : "text-gray-400"
                    )}>
                      · 5 credits
                    </span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* ════════════════════════ RIGHT PANEL ═════════════════════════════ */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── Tab bar ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActivePanel("images")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                activePanel === "images"
                  ? "bg-white text-[#1A2E44] shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <ImageIcon size={13} />
              Generated Images
              {total > 0 && (
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                  activePanel === "images" ? "bg-gray-100 text-gray-400" : "bg-gray-200 text-gray-400"
                )}>
                  {total}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActivePanel("briefs")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                activePanel === "briefs"
                  ? "bg-white text-[#1A2E44] shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <FileText size={13} />
              Product Briefs
              {briefs.length > 0 && (
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                  activePanel === "briefs"
                    ? "bg-[#E8F5EE] text-[#1A7A4A]"
                    : "bg-gray-200 text-gray-400"
                )}>
                  {briefs.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Generated Images panel ───────────────────────────────────── */}
          {activePanel === "images" ? (
            <>
              {!galleryReady ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ImageCardSkeleton key={i} aspect="square" />
                  ))}
                </div>

              ) : images.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                  className="flex flex-col items-center justify-center py-24 gap-4 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#E8F5EE] flex items-center justify-center">
                    <ImageIcon size={28} className="text-[#1A7A4A]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1A2E44]">No images yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Describe your vision on the left and hit Generate
                    </p>
                  </div>
                </motion.div>

              ) : (
                <>
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                    layout
                  >
                    <AnimatePresence mode="popLayout">
                      {images.map((img) => (
                        <ImageCard
                          key={img.id}
                          image={img}
                          onDelete={handleDelete}
                          onShowToast={showToast}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>

                  {hasMore && (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-[#1A7A4A] transition-colors disabled:opacity-50"
                      >
                        {loadingMore && <Loader2 size={14} className="animate-spin" />}
                        {loadingMore ? "Loading…" : `Load more (${total - images.length} remaining)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>

          ) : (
            /* ── Product Briefs panel ────────────────────────────────────── */
            <div className="space-y-6">

              {/* Bulk upload card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-[#1A2E44]">Bulk Product Upload</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Upload up to 15 product images — AI generates a full post brief for each one.
                  </p>
                </div>

                <input
                  ref={bulkInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { if (e.target.files) handleBulkFileAdd(e.target.files); }}
                />

                {/* Pending files grid */}
                {pendingFiles.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {pendingFiles.map((pf) => (
                        <div
                          key={pf.uid}
                          className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pf.preview}
                            alt={pf.file.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePendingFile(pf.uid)}
                            disabled={isBulkBusy}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:hidden"
                            title="Remove"
                          >
                            <X size={10} className="text-white" />
                          </button>
                        </div>
                      ))}
                      {pendingFiles.length < 15 && !isBulkBusy && (
                        <button
                          type="button"
                          onClick={() => bulkInputRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-[#1A7A4A]/50 hover:bg-[#E8F5EE]/30 transition-colors text-gray-300 text-xl font-light"
                        >
                          +
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{pendingFiles.length}/15 images selected</p>
                  </div>
                ) : (
                  /* Drop zone */
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !isBulkBusy && bulkInputRef.current?.click()}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && !isBulkBusy && bulkInputRef.current?.click()
                    }
                    onDragOver={(e) => { e.preventDefault(); setBulkDragOver(true); }}
                    onDragLeave={() => setBulkDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setBulkDragOver(false);
                      handleBulkFileAdd(e.dataTransfer.files);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 px-6 py-12 rounded-2xl border-2 border-dashed cursor-pointer select-none transition-all duration-150",
                      bulkDragOver
                        ? "border-[#1A7A4A] bg-[#E8F5EE]/60"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <UploadCloud
                      size={30}
                      className={cn(
                        "transition-colors",
                        bulkDragOver ? "text-[#1A7A4A]" : "text-gray-300"
                      )}
                    />
                    <div className="text-center">
                      <p className={cn(
                        "text-sm font-medium transition-colors",
                        bulkDragOver ? "text-[#1A7A4A]" : "text-gray-500"
                      )}>
                        Click to upload or drag &amp; drop
                      </p>
                      <p className="text-xs text-gray-300 mt-1">
                        Up to 15 images · JPEG · PNG · WebP · Max 10 MB each
                      </p>
                    </div>
                  </div>
                )}

                {/* Progress indicator or generate button */}
                {isBulkBusy ? (
                  <div className="flex items-center justify-center gap-2.5 py-3">
                    <Loader2 size={16} className="animate-spin text-[#1A7A4A]" />
                    <p className="text-sm text-[#1A7A4A] font-medium">{briefProgress}</p>
                  </div>
                ) : pendingFiles.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleUploadAndGenerate}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A7A4A] hover:bg-[#145C38] text-white text-sm font-semibold transition-colors shadow-sm"
                  >
                    <Sparkles size={15} />
                    Upload &amp; Generate Post Ideas
                  </button>
                ) : null}
              </div>

              {/* Briefs grid */}
              {!briefsLoaded ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ImageCardSkeleton key={i} aspect="square" />
                  ))}
                </div>
              ) : briefs.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-bold text-[#1A2E44]">Post Briefs</h3>
                    <span className="text-xs font-medium text-[#1A7A4A] bg-[#E8F5EE] px-2 py-0.5 rounded-full">
                      {briefs.length}
                    </span>
                  </div>
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                    layout
                  >
                    <AnimatePresence mode="popLayout">
                      {briefs.map((brief) => (
                        <BriefCard
                          key={brief.id}
                          brief={brief}
                          onUseAsPrompt={handleUseAsPrompt}
                          onPostsGenerated={handlePostsGenerated}
                          onShowToast={showToast}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="flex flex-col items-center justify-center py-20 gap-4 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#E8F5EE] flex items-center justify-center">
                    <FileText size={24} className="text-[#1A7A4A]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1A2E44]">No briefs yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Upload product images above to generate your first post briefs
                    </p>
                  </div>
                </motion.div>
              )}

            </div>
          )}

        </div>
      </div>
    </>
  );
}
