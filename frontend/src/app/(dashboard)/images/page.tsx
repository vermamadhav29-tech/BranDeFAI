"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Pencil,
  Check,
  RefreshCw,
  X,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useBrandStore } from "@/stores/brandStore";
import { useAuthStore } from "@/stores/authStore";

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

// ─── CalendarModal ────────────────────────────────────────────────────────────

function LocalCalendarModal({ imageId, onClose, onAdded }: { imageId: string; onClose: () => void; onAdded: () => void }) {
  const now = new Date();
  const [day, setDay] = useState(now.getDate());
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const daysInMonth = new Date(year, month, 0).getDate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await apiClient.post("/api/calendar/entry", { calendarDay: day, month, year, contentType: "IMAGE", contentId: imageId });
      onAdded();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Failed to add to calendar.");
      setSaving(false);
    }
  }

  return (
    <div className="bd-modal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label="Add to calendar">
      <div className="bd-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add to calendar</h3>
        <p className="bd-card-sub">
          Pick a day in {new Date(year, month - 1, 1).toLocaleString("en", { month: "long" })} {year}
        </p>
        <div className="bd-days">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <button key={d} type="button" className={(d === day ? "is-on " : "") + (d < now.getDate() ? "past" : "")} onClick={() => setDay(d)}>
              {d}
            </button>
          ))}
        </div>
        {error && <p className="bd-error" style={{ marginTop: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="bd-btn bd-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="bd-btn bd-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="bd-spin-icon" /> : <CalendarPlus size={16} />}
            {saving ? "Saving…" : `Schedule for ${day}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PostStatus, { label: string; chip: string }> = {
  PENDING_APPROVAL: { label: "Pending approval", chip: "a" },
  APPROVED: { label: "Approved", chip: "g" },
  SCHEDULED: { label: "Scheduled", chip: "b" },
  POSTED: { label: "Posted", chip: "" },
};

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, onStatusChange, onDelete }: { post: GeneratedPost; onStatusChange: (id: string, status: PostStatus) => void; onDelete: (id: string) => void }) {
  const [imgError, setImgError] = useState(false);
  const [caption, setCaption] = useState(post.caption ?? "");
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
      setCaption(captionDraft);
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
      toast.error("Could not delete the post.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const captionPreview = caption.length > 140 ? caption.slice(0, 140) + "…" : caption;

  return (
    <>
      {calendarOpen && <LocalCalendarModal imageId={post.id} onClose={() => setCalendarOpen(false)} onAdded={() => toast.success("Added to calendar!")} />}

      <div className="bd-pcard bd-reveal">
        <div className="img">
          {imgError ? (
            <div style={{ textAlign: "center", fontSize: 13 }}>
              <ImageIcon size={30} style={{ marginBottom: 6 }} />
              <div>Image unavailable</div>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt="AI generated post" loading="lazy" onError={() => setImgError(true)} />
          )}
          <div className="badges">
            {post.occasionName ? <span className="bd-chip">{post.occasionName}</span> : <span />}
            <span className={"bd-chip " + cfg.chip}>{cfg.label}</span>
          </div>
        </div>

        <div className="body">
          {editingCaption ? (
            <div style={{ display: "grid", gap: 8 }}>
              <textarea className="bd-textarea" value={captionDraft} onChange={(e) => setCaptionDraft(e.target.value)} rows={5} style={{ minHeight: 110, fontSize: 14 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="bd-btn bd-btn-primary bd-btn-sm" onClick={handleSaveCaption} disabled={savingCaption}>
                  {savingCaption ? <Loader2 size={13} className="bd-spin-icon" /> : <Check size={13} />} Save
                </button>
                <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => { setEditingCaption(false); setCaptionDraft(caption); }}>Cancel</button>
              </div>
            </div>
          ) : captionPreview ? (
            captionPreview
          ) : (
            <span style={{ color: "var(--muted)" }}>No caption</span>
          )}
          {post.hashtags.length > 0 && !editingCaption && (
            <div className="tags">
              {post.hashtags.slice(0, 5).map((h) => `#${h}`).join(" ")}
              {post.hashtags.length > 5 && ` +${post.hashtags.length - 5}`}
            </div>
          )}
        </div>

        <div className="acts">
          {post.status === "PENDING_APPROVAL" && (
            <button type="button" className="bd-btn bd-btn-green bd-btn-sm" style={{ flex: 1 }} onClick={handleApprove} disabled={approving}>
              {approving ? <Loader2 size={14} className="bd-spin-icon" /> : <CheckCircle2 size={14} />} Approve
            </button>
          )}
          {!editingCaption && (
            <button type="button" className="bd-iconbtn" onClick={() => setEditingCaption(true)} title="Edit caption" aria-label="Edit caption">
              <Pencil size={15} />
            </button>
          )}
          <button type="button" className="bd-iconbtn" onClick={() => setCalendarOpen(true)} title="Add to calendar" aria-label="Add to calendar">
            <CalendarPlus size={15} />
          </button>
          {confirmDelete ? (
            <>
              <button type="button" className="bd-btn bd-btn-sm" style={{ background: "var(--red-bg)", color: "var(--red)" }} onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 size={13} className="bd-spin-icon" /> : <Trash2 size={13} />} Delete
              </button>
              <button type="button" className="bd-iconbtn" onClick={() => setConfirmDelete(false)} aria-label="Cancel delete"><X size={15} /></button>
            </>
          ) : (
            <button type="button" className="bd-iconbtn danger" onClick={() => setConfirmDelete(true)} title="Delete" aria-label="Delete post">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { key: "ALL" | PostStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING_APPROVAL", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "POSTED", label: "Posted" },
];

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

  // Refresh key — increment to re-fetch posts (after fire-and-forget upload completes)
  const [postsRefreshTick, setPostsRefreshTick] = useState(0);
  const refreshTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clean up scheduled refreshes on unmount
  useEffect(() => () => refreshTimersRef.current.forEach(clearTimeout), []);

  // Occasion
  const [occasion, setOccasion] = useState<OccasionInfo | null>(null);

  // Generation
  const [generating, setGenerating] = useState(false);

  // Generated posts
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [tab, setTab] = useState<"ALL" | PostStatus>("ALL");

  // ── Load products ──
  useEffect(() => {
    if (!brand) return;
    apiClient
      .get<{ success: boolean; data: { images: ProductImage[] } }>("/api/uploads/product-images")
      .then((res) => {
        if (res.data.success && res.data.data?.images) {
          setProducts(res.data.data.images);
          if (res.data.data.images.length > 0) setSelectedProductId(res.data.data.images[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setProductsLoaded(true));
  }, [brand]);

  // ── Load posts (re-runs when postsRefreshTick increments) ──
  useEffect(() => {
    // On initial load show the skeleton; on background refreshes keep existing posts visible
    if (postsRefreshTick === 0) setPostsLoaded(false);
    apiClient
      .get<{ success: boolean; data: { posts: GeneratedPost[] } }>("/api/creative/posts")
      .then((res) => {
        if (res.data.success && res.data.data?.posts) setPosts(res.data.data.posts);
      })
      .catch(() => {})
      .finally(() => setPostsLoaded(true));
  }, [postsRefreshTick]);

  // ── Load occasion ──
  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: { occasions: OccasionInfo[] } }>("/api/creative/occasions")
      .then((res) => setOccasion(res.data.data?.occasions?.[0] ?? null))
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
      const res = await apiClient.post<{ success: boolean; data: { productImageId: string; imageUrl: string }; error: string | null }>("/api/uploads/product-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success && res.data.data) {
        const newImg: ProductImage = { id: res.data.data.productImageId, imageUrl: res.data.data.imageUrl, uploadedAt: new Date().toISOString() };
        setProducts((prev) => [newImg, ...prev]);
        setSelectedProductId(newImg.id);
        toast.success("Photo uploaded! Generating your post in the background…");

        // Background generation takes ~90–150s; schedule two auto-refreshes to
        // surface the new post without requiring a manual page reload.
        const t1 = setTimeout(() => setPostsRefreshTick((n) => n + 1), 95_000);
        const t2 = setTimeout(() => setPostsRefreshTick((n) => n + 1), 165_000);
        refreshTimersRef.current.push(t1, t2);
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
      const res = await apiClient.post<{ success: boolean; data: { post: GeneratedPost }; error: string | null }>("/api/creative/generate", { productImageId: selectedProductId });

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
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: posts.length };
    for (const p of posts) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [posts]);
  const pendingCount = counts.PENDING_APPROVAL ?? 0;
  const visible = tab === "ALL" ? posts : posts.filter((p) => p.status === tab);
  const lowCredits = (user?.creditsBalance ?? 0) < 2;

  return (
    <div className="bd-flow">
      <div className="bd-pagehead">
        <div>
          <h1>Image studio</h1>
          <p>Turn product photos into on-brand Instagram posts. Review, edit and approve each one.</p>
        </div>
        <Link href="/dashboard" className="bd-btn bd-btn-ghost bd-btn-sm">Bulk product posts</Link>
      </div>

      <div className="bd-studio">
        {/* ═════ LEFT: create ═════ */}
        <div className="bd-flow bd-sticky">
          <div className="bd-card bd-reveal">
            <div className="bd-card-head">
              <div>
                <h2 className="bd-card-title">Create a post</h2>
                <p className="bd-card-sub">Pick a product photo and let AI do the rest.</p>
              </div>
            </div>

            {productsLoaded && hasProducts && (
              <div>
                <p className="bd-label" style={{ marginBottom: 10 }}>Your product photos</p>
                <div className="bd-products">
                  {products.slice(0, 11).map((p) => (
                    <button key={p.id} type="button" className={"bd-product" + (selectedProductId === p.id ? " is-on" : "")} onClick={() => setSelectedProductId(p.id)} aria-label="Select product photo" aria-pressed={selectedProductId === p.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="Product" />
                      {selectedProductId === p.id && <span className="tick"><Check size={13} /></span>}
                    </button>
                  ))}
                  <button type="button" className="bd-product add" onClick={() => fileInputRef.current?.click()} title="Add photo" aria-label="Add a product photo" disabled={uploading}>
                    {uploading ? <Loader2 size={18} className="bd-spin-icon" /> : "+"}
                  </button>
                </div>
              </div>
            )}

            {!productsLoaded && <div className="bd-skel" style={{ height: 160, borderRadius: 22 }} />}

            {productsLoaded && !hasProducts && (
              <div
                className={"bd-drop" + (uploadDrag ? " is-over" : "")}
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
              >
                {uploading ? (
                  <>
                    <Loader2 size={26} className="bd-spin-icon" style={{ color: "var(--p)" }} />
                    <b>Uploading…</b>
                  </>
                ) : (
                  <>
                    <span className="ico"><UploadCloud size={26} /></span>
                    <b>Upload your first product photo</b>
                    <span>JPEG · PNG · WebP · max 10 MB</span>
                  </>
                )}
              </div>
            )}

            {uploading && hasProducts && (
              <div className="bd-busy" style={{ marginBottom: 0 }}>
                <Loader2 size={15} className="bd-spin-icon" /> Uploading &amp; analyzing photo…
              </div>
            )}

            <input ref={fileInputRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />

            <div style={{ marginTop: 18 }}>
              {occasion ? (
                <div className="bd-occ-banner">
                  <span>
                    <b>{occasion.name}</b> is in {occasion.days_away} day{occasion.days_away !== 1 ? "s" : ""}. AI will create a {occasion.name} post.
                  </span>
                </div>
              ) : (
                <div className="bd-occ-banner" style={{ background: "var(--bg)", color: "var(--gray)" }}>
                  <span>No upcoming occasion. AI will create a brand awareness post.</span>
                </div>
              )}
            </div>

            <button type="button" className="bd-btn bd-btn-primary" style={{ width: "100%", height: 50, marginTop: 18 }} onClick={handleGenerate} disabled={generating || !hasProducts || !selectedProductId || lowCredits}>
              {generating ? (<><Loader2 size={17} className="bd-spin-icon" /> Creating post…</>) : (<><Sparkles size={17} /> Create post</>)}
            </button>
            <p className="bd-hint" style={{ textAlign: "center", marginTop: 10 }}>
              {lowCredits ? <>You need at least 2 credits. <Link href="/credits" className="bd-link" style={{ display: "inline" }}>Get credits</Link></> : "Uses your brand style automatically · 2 credits"}
            </p>
          </div>

          {pendingCount > 0 && (
            <button type="button" className="bd-occ-banner" style={{ border: 0, textAlign: "left", cursor: "pointer", font: "inherit", width: "100%", background: "var(--tint)", color: "var(--p)" }} onClick={() => setTab("PENDING_APPROVAL")}>
              <Clock size={20} />
              <span><b>{pendingCount} post{pendingCount !== 1 ? "s" : ""}</b> waiting for your approval →</span>
            </button>
          )}
        </div>

        {/* ═════ RIGHT: posts ═════ */}
        <div className="bd-flow">
          <div className="bd-card bd-reveal" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div className="bd-filters" role="tablist">
                {TABS.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={"bd-tab-btn" + (tab === t.key ? " is-on" : "")} onClick={() => setTab(t.key)}>
                    {t.label} <small>{counts[t.key] ?? 0}</small>
                  </button>
                ))}
              </div>
              <button type="button" className="bd-iconbtn" onClick={() => setPostsRefreshTick((n) => n + 1)} title="Refresh posts" aria-label="Refresh posts">
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {!postsLoaded ? (
            <div className="bd-postgrid">
              {[0, 1, 2].map((i) => <div key={i} className="bd-skel" style={{ aspectRatio: "4 / 6", borderRadius: 24 }} />)}
            </div>
          ) : visible.length === 0 ? (
            <div className="bd-card" style={{ textAlign: "center", padding: "56px 24px" }}>
              <span className="bd-stat-ico" style={{ width: 64, height: 64, borderRadius: 22, margin: "0 auto 18px", background: "var(--tint)", color: "var(--p)" }}>
                <ImageIcon size={28} />
              </span>
              <h2 className="bd-card-title" style={{ fontSize: 22 }}>{posts.length === 0 ? "Your AI-generated posts will appear here" : "No posts in this view"}</h2>
              <p className="bd-card-sub" style={{ marginTop: 8 }}>{posts.length === 0 ? "Upload a product photo and click Create post." : "Try another filter above."}</p>
            </div>
          ) : (
            <div className="bd-postgrid">
              {visible.map((post) => (
                <PostCard key={post.id} post={post} onStatusChange={handleStatusChange} onDelete={handleDeletePost} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
