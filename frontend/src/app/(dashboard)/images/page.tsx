"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Trash2,
  Image as ImageIcon,
  X,
  UploadCloud,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  AlertCircle,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useBrandStore } from "@/stores/brandStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { ImageCardSkeleton } from "@/components/ui/Skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductImage {
  id: string;
  imageUrl: string;
  uploadedAt: string;
}

type PostStatus = "PENDING_APPROVAL" | "APPROVED" | "SCHEDULED" | "POSTED";

interface GeneratedPost {
  id: string;
  imageUrl: string;
  caption: string | null;
  hashtags: string[];
  occasionName: string | null;
  occasionEmoji: string | null;
  status: PostStatus;
  createdAt: string;
  scheduledAt: string | null;
  productImage: { imageUrl: string } | null;
}

interface OccasionInfo {
  name: string;
  emoji: string;
  days_away: number;
  hook: string;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── CalendarModal ────────────────────────────────────────────────────────────
// Re-declared locally if the shared component doesn't exist
function LocalCalendarModal({
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
        calendarDay: day, month, year, contentType: "IMAGE", contentId: imageId,
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
        className="rounded-2xl shadow-xl p-6 w-72 mx-4"
        style={{ background: "var(--bg-card)" }}
      >
        <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Add to Calendar</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Schedule for {new Date(year, month - 1, 1).toLocaleString("en", { month: "long" })} {year}
        </p>
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Day (1–31)</label>
        <input
          type="number" min={1} max={31} value={day}
          onChange={(e) => setDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
          className="mt-1.5 w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/25 focus:border-[#1A7A4A]"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-input, white)", color: "var(--text-primary)" }}
        />
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors"
            style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#1A7A4A] hover:bg-[#145C38] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />}
            {saving ? "Saving…" : "Schedule"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PostStatus, { label: string; color: string; bg: string }> = {
  PENDING_APPROVAL: { label: "Pending Approval", color: "#D97706", bg: "rgba(245,158,11,0.1)" },
  APPROVED:         { label: "Approved",          color: "#059669", bg: "rgba(16,185,129,0.1)" },
  SCHEDULED:        { label: "Scheduled",         color: "#2563EB", bg: "rgba(37,99,235,0.1)"  },
  POSTED:           { label: "Posted",            color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
};

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onStatusChange,
  onDelete,
}: {
  post: GeneratedPost;
  onStatusChange: (id: string, status: PostStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption ?? "");
  const [savingCaption, setSavingCaption] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const cfg = STATUS_CONFIG[post.status];

  async function handleApprove() {
    setApproving(true);
    try {
      await apiClient.patch(`/api/creative/posts/${post.id}/status`, { status: "APPROVED" });
      onStatusChange(post.id, "APPROVED");
      toast.success("Post approved!");
    } catch {
      toast.error("Failed to approve post.");
    } finally {
      setApproving(false);
    }
  }

  async function handleSaveCaption() {
    setSavingCaption(true);
    try {
      await apiClient.patch(`/api/creative/posts/${post.id}/caption`, { caption: captionDraft });
      setEditingCaption(false);
      toast.success("Caption updated.");
    } catch {
      toast.error("Failed to save caption.");
    } finally {
      setSavingCaption(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiClient.delete(`/api/creative/posts/${post.id}`);
      onDelete(post.id);
      toast.success("Post deleted.");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const captionPreview = (post.caption ?? "").slice(0, 80) + ((post.caption ?? "").length > 80 ? "…" : "");

  return (
    <>
      {calendarOpen && (
        <LocalCalendarModal
          imageId={post.id}
          onClose={() => setCalendarOpen(false)}
          onAdded={() => toast.success("Added to calendar!")}
        />
      )}

      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
      >
        {/* Post image */}
        <div className="relative overflow-hidden bg-gray-100" style={{ aspectRatio: "4 / 5" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt="AI generated post"
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {/* Occasion badge */}
          {post.occasionName && (
            <div className="absolute top-3 left-3">
              <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded-full shadow-md"
                style={{ background: "rgba(0,0,0,0.6)" }}>
                {post.occasionEmoji} {post.occasionName}
              </span>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Caption */}
        <div className="p-4 space-y-3">
          {editingCaption ? (
            <div className="space-y-2">
              <textarea
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-xs rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/25 focus:border-[#1A7A4A]"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-input, white)", color: "var(--text-primary)" }}
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveCaption} disabled={savingCaption}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#1A7A4A] text-white text-xs font-semibold">
                  {savingCaption ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Save
                </button>
                <button type="button" onClick={() => { setEditingCaption(false); setCaptionDraft(post.caption ?? ""); }}
                  className="flex-1 py-1.5 rounded-lg border text-xs font-semibold"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
              {captionPreview || <span style={{ color: "var(--text-muted)" }}>No caption</span>}
            </p>
          )}

          {/* Hashtags */}
          {post.hashtags.length > 0 && !editingCaption && (
            <p className="text-[11px] truncate" style={{ color: "#1A7A4A" }}>
              {post.hashtags.slice(0, 5).map(h => `#${h}`).join(" ")}
              {post.hashtags.length > 5 && ` +${post.hashtags.length - 5}`}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-1.5 pt-1">
            {post.status === "PENDING_APPROVAL" && (
              <button type="button" onClick={handleApprove} disabled={approving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1A7A4A] text-white text-xs font-semibold transition-all flex-1 justify-center">
                {approving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Approve
              </button>
            )}

            {!editingCaption && (
              <button type="button" onClick={() => setEditingCaption(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                title="Edit Caption">
                <Pencil size={11} />
              </button>
            )}

            <button type="button" onClick={() => setCalendarOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors"
              style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
              title="Add to Calendar">
              <CalendarPlus size={11} />
            </button>

            {confirmDelete ? (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold flex items-center gap-1 ml-auto">
                {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Confirm
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="ml-auto px-2.5 py-1.5 rounded-lg border text-xs transition-colors"
                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                title="Delete">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImagesPage() {
  const brand = useBrandStore((s) => s.brand);
  const user = useAuthStore((s) => s.user);
  const updateCredits = useAuthStore((s) => s.updateCredits);

  // Product images
  const [products, setProducts] = useState<ProductImage[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadDrag, setUploadDrag] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI override (collapsed by default)
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideText, setOverrideText] = useState("");

  // Occasion
  const [occasion, setOccasion] = useState<OccasionInfo | null>(null);

  // Generation
  const [generating, setGenerating] = useState(false);

  // Generated posts
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);

  // ── Load products ──
  useEffect(() => {
    if (!brand) return;
    apiClient
      .get<{ success: boolean; data: { images: ProductImage[] } }>("/api/uploads/product-images")
      .then((res) => {
        if (res.data.success && res.data.data?.images) {
          setProducts(res.data.data.images);
          if (res.data.data.images.length > 0) {
            setSelectedProductId(res.data.data.images[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setProductsLoaded(true));
  }, [brand]);

  // ── Load posts ──
  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: { posts: GeneratedPost[] } }>("/api/creative/posts")
      .then((res) => {
        if (res.data.success && res.data.data?.posts) {
          setPosts(res.data.data.posts);
        }
      })
      .catch(() => {})
      .finally(() => setPostsLoaded(true));
  }, []);

  // ── Load occasion ──
  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: { occasions: OccasionInfo[] } }>("/api/creative/occasions")
      .then((res) => {
        const occ = res.data.data?.occasions?.[0] ?? null;
        setOccasion(occ);
      })
      .catch(() => {});
  }, []);

  // ── Upload product photo ──
  const handleUpload = useCallback(async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error("Use JPEG, PNG or WebP under 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await apiClient.post<{
        success: boolean;
        data: { productImageId: string; imageUrl: string };
        error: string | null;
      }>("/api/uploads/product-image", form, { headers: { "Content-Type": "multipart/form-data" } });

      if (res.data.success && res.data.data) {
        const newImg: ProductImage = {
          id: res.data.data.productImageId,
          imageUrl: res.data.data.imageUrl,
          uploadedAt: new Date().toISOString(),
        };
        setProducts((prev) => [newImg, ...prev]);
        setSelectedProductId(newImg.id);
        toast.success("Photo uploaded! Generating your post in the background…");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e.response?.data?.error ?? e.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Manual generate ──
  const handleGenerate = useCallback(async () => {
    if (generating || !selectedProductId) return;
    if (!user || user.creditsBalance < 2) {
      toast.error("You need at least 2 credits to generate a post.");
      return;
    }
    setGenerating(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { post: GeneratedPost };
        error: string | null;
      }>("/api/creative/generate", { productImageId: selectedProductId });

      if (res.data.success && res.data.data?.post) {
        setPosts((prev) => [res.data.data.post, ...prev]);
        updateCredits(Math.max(0, (user?.creditsBalance ?? 2) - 2));
        toast.success("Post created!");
      } else {
        toast.error(res.data.error ?? "Generation failed.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e.response?.data?.error ?? e.message ?? "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [generating, selectedProductId, user, updateCredits]);

  const handleStatusChange = useCallback((id: string, status: PostStatus) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const handleDeletePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const hasProducts = products.length > 0;
  const pendingCount = posts.filter((p) => p.status === "PENDING_APPROVAL").length;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">

      {/* ════════════════════════ LEFT PANEL ══════════════════════════════ */}
      <div className="w-full lg:w-[320px] shrink-0 space-y-4 lg:sticky lg:top-0">

        {/* ── Product Photos ───────────────────────────────────────────── */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}>

          <div>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Image Studio</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>AI-powered promotional posts</p>
          </div>

          {/* Product grid */}
          {productsLoaded && hasProducts && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                Your Product Photos
              </p>
              <div className="grid grid-cols-4 gap-2">
                {products.slice(0, 11).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProductId(p.id)}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                      selectedProductId === p.id
                        ? "border-[#1A7A4A] ring-1 ring-[#1A7A4A]/40"
                        : "border-transparent hover:border-gray-300"
                    )}
                    style={{ background: "var(--border-color)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt="Product" className="w-full h-full object-cover" />
                    {selectedProductId === p.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#1A7A4A]/20">
                        <Check size={14} className="text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                ))}

                {/* Add more button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-lg font-light transition-all hover:opacity-70"
                  style={{ borderColor: "var(--border-hover, #d1d5db)", color: "var(--text-muted)" }}
                  title="Add photo"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Upload zone — shown when no products yet or as primary CTA */}
          {productsLoaded && !hasProducts && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !uploading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setUploadDrag(true); }}
              onDragLeave={() => setUploadDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setUploadDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleUpload(f);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer select-none transition-all",
                uploadDrag ? "border-[#1A7A4A] bg-[#E8F5EE]/40" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              {uploading ? (
                <>
                  <Loader2 size={26} className="text-[#1A7A4A] animate-spin" />
                  <p className="text-xs text-[#1A7A4A] font-medium">Uploading…</p>
                </>
              ) : (
                <>
                  <UploadCloud size={26} className={uploadDrag ? "text-[#1A7A4A]" : "text-gray-300"} />
                  <div className="text-center">
                    <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                      Upload your first product photo
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      JPEG · PNG · WebP · Max 10 MB
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Upload progress indicator when products exist */}
          {uploading && hasProducts && (
            <div className="flex items-center gap-2 py-1">
              <Loader2 size={13} className="animate-spin text-[#1A7A4A] shrink-0" />
              <p className="text-xs text-[#1A7A4A]">Uploading & analyzing photo…</p>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />

          {/* ── Optional override ─────────────────────────────────────── */}
          <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
            <button
              type="button"
              onClick={() => setOverrideOpen((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Optional — Override AI
              {overrideOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <AnimatePresence initial={false}>
              {overrideOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="overflow-hidden mt-2"
                >
                  <textarea
                    value={overrideText}
                    onChange={(e) => setOverrideText(e.target.value)}
                    rows={3}
                    placeholder="Leave empty to let AI decide automatically…"
                    className="w-full px-3 py-2 text-xs rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/25 focus:border-[#1A7A4A]"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-input, white)", color: "var(--text-primary)" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Occasion info ─────────────────────────────────────────── */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--bg-subtle, #f9fafb)", border: "1px solid var(--border-color)" }}>
            {occasion ? (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="font-semibold">{occasion.emoji} {occasion.name}</span> in {occasion.days_away} day{occasion.days_away !== 1 ? "s" : ""} — AI will create a {occasion.name} post
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No upcoming occasion — AI will create a brand awareness post
              </p>
            )}
          </div>

          {/* ── Generate button ───────────────────────────────────────── */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !hasProducts || !selectedProductId}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all",
                generating || !hasProducts || !selectedProductId
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-[#1A7A4A] hover:bg-[#145C38] text-white shadow-sm"
              )}
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating Post…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Create Post
                </>
              )}
            </button>
            <p className="text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
              AI uses your brand style automatically · 2 credits
            </p>
          </div>
        </div>

        {/* Pending count indicator */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <Clock size={14} style={{ color: "#D97706" }} />
            <p className="text-xs font-medium" style={{ color: "#D97706" }}>
              {pendingCount} post{pendingCount !== 1 ? "s" : ""} waiting for approval →
            </p>
          </div>
        )}

      </div>

      {/* ════════════════════════ RIGHT PANEL ═════════════════════════════ */}
      <div className="flex-1 min-w-0">

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
            Generated Posts
            {posts.length > 0 && (
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: "var(--bg-subtle, #f3f4f6)", color: "var(--text-muted)" }}>
                {posts.length}
              </span>
            )}
          </h2>
        </div>

        {!postsLoaded ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <ImageCardSkeleton key={i} aspect="portrait" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="flex flex-col items-center justify-center py-24 gap-4 text-center rounded-2xl border-2 border-dashed"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(26,122,74,0.08)" }}>
              <ImageIcon size={28} style={{ color: "#1A7A4A" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Your AI-generated posts will appear here
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Upload a product photo and click Create Post
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" layout>
            <AnimatePresence mode="popLayout">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeletePost}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

      </div>
    </div>
  );
}
