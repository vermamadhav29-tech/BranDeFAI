"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, ImageIcon, Mic, Sparkles, Upload, LogOut, Zap, Trash2 } from "lucide-react";
import apiClient from "@/lib/apiClient";
import { useBrandStore } from "@/stores/brandStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/lib/toast";
import { INDUSTRIES, PLATFORMS, TONES, MAX_TONES, parseTones } from "@/lib/brandOptions";
import { DeleteCompanyModal, useDeleteMainBrand } from "@/components/features/DeleteCompanyModal";
import type { Brand } from "@/types";

// ─── LogoSection ──────────────────────────────────────────────────────────────

function LogoSection({ brand, onLogoChange }: { brand: Brand; onLogoChange: (logoUrl: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      const allowed = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];
      if (!allowed.includes(file.type)) {
        setUploadError("Only PNG, SVG, JPEG, and WebP are accepted.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setUploadError("Logo must be 2 MB or smaller.");
        return;
      }
      setUploading(true);
      setUploadError(null);
      try {
        const formData = new FormData();
        formData.append("logo", file);
        const uploadRes = await apiClient.post<{ success: boolean; data: { logoUrl: string }; error: string | null }>("/api/uploads/brand-logo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (!uploadRes.data.success || !uploadRes.data.data) {
          setUploadError(uploadRes.data.error ?? "Upload failed.");
          return;
        }

        const newLogoUrl = uploadRes.data.data.logoUrl;
        await apiClient.patch("/api/brand/logo", { logoUrl: newLogoUrl });
        onLogoChange(newLogoUrl);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        setUploadError(e.response?.data?.error ?? e.message ?? "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [onLogoChange],
  );

  async function handleRemove() {
    setRemoving(true);
    try {
      await apiClient.patch("/api/brand/logo", { logoUrl: null });
      onLogoChange(null);
      setConfirmRemove(false);
    } catch {
      toast.error("Could not remove the logo. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="bd-card bd-reveal">
      <div className="bd-card-head">
        <div>
          <h2 className="bd-card-title">Brand logo</h2>
          <p className="bd-card-sub">PNG or SVG with a transparent background works best. Max 2 MB.</p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      {brand.logoUrl ? (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="bd-logo-box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logoUrl} alt="Logo on light background" />
            </div>
            <div className="bd-logo-box dark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logoUrl} alt="Logo on dark background" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={14} /> {uploading ? "Uploading…" : "Change logo"}
            </button>
            {confirmRemove ? (
              <>
                <button className="bd-btn bd-btn-sm" style={{ background: "var(--red-bg)", color: "var(--red)" }} onClick={handleRemove} disabled={removing}>
                  {removing ? <Loader2 size={14} className="bd-spin-icon" /> : <Trash2 size={14} />} Confirm remove
                </button>
                <button className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => setConfirmRemove(false)}>Cancel</button>
              </>
            ) : (
              <button className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => setConfirmRemove(true)}>Remove</button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={"bd-drop" + (dragOver ? " is-over" : "")}
          role="button"
          tabIndex={0}
          onClick={() => !uploading && fileRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !uploading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleUpload(file);
          }}
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="bd-spin-icon" style={{ color: "var(--p)" }} />
              <b>Uploading…</b>
            </>
          ) : (
            <>
              <span className="ico"><ImageIcon size={24} /></span>
              <b>Click to upload or drag &amp; drop</b>
              <span>PNG · SVG · JPEG · WebP · max 2 MB</span>
            </>
          )}
        </div>
      )}

      {uploadError && <p className="bd-error">{uploadError}</p>}
    </div>
  );
}

// ─── BrandVoiceSection ────────────────────────────────────────────────────────

function BrandVoiceSection({ brand, onVoiceUpdate, onError }: { brand: Brand; onVoiceUpdate: (voiceSummary: string) => void; onError: () => void }) {
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: { voiceSummary: string }; error: string | null }>("/api/brand/regenerate-voice");
      if (res.data.success && res.data.data?.voiceSummary) onVoiceUpdate(res.data.data.voiceSummary);
    } catch {
      onError();
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="bd-card bd-reveal">
      <div className="bd-card-head">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span className="bd-stat-ico" style={{ background: "var(--tint)", color: "var(--p)", flexShrink: 0 }}><Mic size={18} /></span>
          <div>
            <h2 className="bd-card-title">Brand voice</h2>
            <p className="bd-card-sub">The AI context used in every caption, ad and script it writes for you.</p>
          </div>
        </div>
        <button className="bd-btn bd-btn-ghost bd-btn-sm" onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? <Loader2 size={14} className="bd-spin-icon" /> : <Sparkles size={14} />}
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {brand.voiceSummary ? (
        <p className="bd-voice">{brand.voiceSummary}</p>
      ) : (
        <div className="bd-empty">
          <strong>No voice summary yet</strong>
          Click &ldquo;Regenerate&rdquo; to create one from your brand profile.
        </div>
      )}
    </div>
  );
}

// ─── BrandProfileSection (editable) ───────────────────────────────────────────

function BrandProfileSection({ brand, onSaved }: { brand: Brand; onSaved: (b: Brand) => void }) {
  const [form, setForm] = useState({
    brandName: brand.brandName ?? "",
    industry: brand.industry ?? "",
    tone: brand.tone || "Professional",
    targetAudience: brand.targetAudience ?? "",
    brandBrief: brand.brandBrief ?? "",
    platforms: brand.platforms ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [writing, setWriting] = useState<null | "targetAudience" | "brandBrief">(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty =
    form.brandName !== (brand.brandName ?? "") ||
    form.industry !== (brand.industry ?? "") ||
    form.tone !== brand.tone ||
    form.targetAudience !== (brand.targetAudience ?? "") ||
    form.brandBrief !== (brand.brandBrief ?? "") ||
    form.platforms.join("|") !== (brand.platforms ?? []).join("|");

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function validate() {
    const e: Record<string, string> = {};
    if (form.brandName.trim().length < 2) e.brandName = "Brand name must be at least 2 characters.";
    if (form.industry.trim().length < 2) e.industry = "Choose or enter an industry.";
    if (form.targetAudience.trim().length < 10) e.targetAudience = "Describe your audience in at least 10 characters.";
    if (form.brandBrief.length > 500) e.brandBrief = "Brand brief must be 500 characters or fewer.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await apiClient.put<{ success: boolean; data: Brand; error: string | null }>("/api/brand", {
        brandName: form.brandName.trim(),
        industry: form.industry.trim(),
        tone: form.tone,
        targetAudience: form.targetAudience.trim(),
        brandBrief: form.brandBrief.trim() || undefined,
        platforms: form.platforms,
      });
      if (res.data.success && res.data.data) {
        onSaved(res.data.data);
        toast.success("Brand profile saved.");
      } else {
        toast.error(res.data.error ?? "Could not save your changes.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e.response?.data?.error ?? "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  }

  async function writeWithAI(field: "targetAudience" | "brandBrief") {
    if (form.brandName.trim().length < 2 || form.industry.trim().length < 2) {
      setErrors((e) => ({ ...e, [field]: "Add your brand name and industry first." }));
      return;
    }
    setWriting(field);
    try {
      const res = await apiClient.post<{ success: boolean; data: { text: string } }>("/api/brand/generate-field", {
        brandName: form.brandName.trim(),
        industry: form.industry.trim(),
        tone: form.tone,
        platforms: form.platforms,
        field,
        draft: form[field].trim() || undefined,
      });
      if (res.data.success && res.data.data?.text) set(field, res.data.data.text);
    } catch {
      toast.error("Could not generate text. Please try again.");
    } finally {
      setWriting(null);
    }
  }

  const industryOptions: string[] = INDUSTRIES.map((i) => i.value);
  if (form.industry && !industryOptions.includes(form.industry)) industryOptions.unshift(form.industry);

  return (
    <div className="bd-card bd-reveal">
      <div className="bd-card-head">
        <div>
          <h2 className="bd-card-title">Brand profile</h2>
          <p className="bd-card-sub">Everything BrandefAI writes and creates is based on this.</p>
        </div>
      </div>

      <div className="bd-two">
        <div className="bd-field">
          <label className="bd-label" htmlFor="s-name">Brand name</label>
          <input id="s-name" className={"bd-input" + (errors.brandName ? " has-error" : "")} value={form.brandName} maxLength={80} onChange={(e) => set("brandName", e.target.value)} />
          {errors.brandName && <p className="bd-field-err">{errors.brandName}</p>}
        </div>
        <div className="bd-field">
          <label className="bd-label" htmlFor="s-industry">Industry</label>
          <select id="s-industry" className={"bd-select bd-input" + (errors.industry ? " has-error" : "")} value={form.industry} onChange={(e) => set("industry", e.target.value)}>
            {industryOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {errors.industry && <p className="bd-field-err">{errors.industry}</p>}
        </div>
      </div>

      <div className="bd-field">
        <span className="bd-label">Tone of voice <span style={{ color: "var(--gray)", fontWeight: 500 }}>(up to {MAX_TONES})</span></span>
        <div className="bd-chipset">
          {TONES.map((t) => {
            const sel = parseTones(form.tone);
            const idx = sel.indexOf(t.value);
            const on = idx >= 0;
            const full = !on && sel.length >= MAX_TONES;
            return (
              <button
                key={t.value}
                type="button"
                disabled={full}
                className={"bd-toggle" + (on ? " is-on" : "")}
                title={`${t.tagline} — ${t.detail}`}
                onClick={() => {
                  const next = on ? sel.filter((x) => x !== t.value) : [...sel, t.value];
                  if (next.length) set("tone", next.join(", "));
                }}
              >
                {on && <Check size={13} />} {t.value}{on && idx === 0 && sel.length > 1 ? " (lead)" : ""}
              </button>
            );
          })}
        </div>
        <p className="bd-hint">
          {parseTones(form.tone).map((v) => TONES.find((t) => t.value === v)?.tagline).filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="bd-field">
        <div className="bd-labelrow">
          <label className="bd-label" htmlFor="s-aud">Target audience</label>
          <button type="button" className="bd-mini-link" onClick={() => writeWithAI("targetAudience")} disabled={writing !== null}>
            {writing === "targetAudience" ? <Loader2 size={13} className="bd-spin-icon" /> : <Sparkles size={13} />} Let AI refine this
          </button>
        </div>
        <textarea id="s-aud" className={"bd-textarea" + (errors.targetAudience ? " has-error" : "")} value={form.targetAudience} maxLength={400} onChange={(e) => set("targetAudience", e.target.value)} />
        {errors.targetAudience && <p className="bd-field-err">{errors.targetAudience}</p>}
      </div>

      <div className="bd-field">
        <div className="bd-labelrow">
          <label className="bd-label" htmlFor="s-brief">Brand brief</label>
          <button type="button" className="bd-mini-link" onClick={() => writeWithAI("brandBrief")} disabled={writing !== null}>
            {writing === "brandBrief" ? <Loader2 size={13} className="bd-spin-icon" /> : <Sparkles size={13} />} Let AI refine this
          </button>
        </div>
        <textarea id="s-brief" className={"bd-textarea" + (errors.brandBrief ? " has-error" : "")} style={{ minHeight: 140 }} value={form.brandBrief} maxLength={500} onChange={(e) => set("brandBrief", e.target.value)} />
        <div className="bd-labelrow">
          {errors.brandBrief ? <p className="bd-field-err">{errors.brandBrief}</p> : <span />}
          <span className="bd-count">{form.brandBrief.length}/500</span>
        </div>
      </div>

      <div className="bd-field">
        <span className="bd-label">Where you sell</span>
        <div className="bd-chipset">
          {PLATFORMS.map((p) => {
            const on = form.platforms.includes(p.value);
            return (
              <button key={p.value} type="button" className={"bd-toggle" + (on ? " is-on" : "")} onClick={() => set("platforms", on ? form.platforms.filter((x) => x !== p.value) : [...form.platforms, p.value])}>
                {p.value}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bd-savebar">
        <span className="bd-hint">{dirty ? "You have unsaved changes." : "All changes saved."}</span>
        <div style={{ display: "flex", gap: 10 }}>
          {dirty && (
            <button
              type="button"
              className="bd-btn bd-btn-ghost"
              onClick={() => {
                setForm({ brandName: brand.brandName ?? "", industry: brand.industry ?? "", tone: brand.tone || "Professional", targetAudience: brand.targetAudience ?? "", brandBrief: brand.brandBrief ?? "", platforms: brand.platforms ?? [] });
                setErrors({});
              }}
            >
              Discard
            </button>
          )}
          <button type="button" className="bd-btn bd-btn-primary" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? <Loader2 size={16} className="bd-spin-icon" /> : <Check size={16} />} Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Account ──────────────────────────────────────────────────────────────────

const PLAN_LABEL: Record<string, string> = { FREE: "Free", PRO: "Pro", BUSINESS: "Business" };

function AccountSection() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const clearBrand = useBrandStore((s) => s.clearBrand);

  async function handleLogout() {
    try { await apiClient.post("/api/auth/logout"); } catch { /* proceed */ }
    clearUser();
    clearBrand();
    router.push("/login");
  }

  if (!user) return null;
  return (
    <div className="bd-card bd-reveal">
      <div className="bd-card-head">
        <h2 className="bd-card-title">Account</h2>
        <span className={"bd-chip " + (user.plan === "FREE" ? "" : "p")}>{PLAN_LABEL[user.plan] ?? user.plan} plan</span>
      </div>
      <dl className="bd-dl">
        <div><dt>Email</dt><dd style={{ wordBreak: "break-all" }}>{user.email}</dd></div>
        <div><dt>Credits</dt><dd style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Zap size={14} style={{ color: "var(--p)" }} />{user.creditsBalance.toLocaleString()}</dd></div>
      </dl>
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <Link href="/credits" className="bd-btn bd-btn-dark bd-btn-sm">Manage billing</Link>
        <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={handleLogout}><LogOut size={14} /> Log out</button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DangerSection({ brand }: { brand: Brand }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteMainBrand();
  return (
    <div className="bd-card bd-reveal">
      <h2 className="bd-card-title">Delete company</h2>
      <p className="bd-card-sub" style={{ margin: "6px 0 14px" }}>
        Permanently remove {brand.brandName} and everything made for it. This can&apos;t be undone.
      </p>
      <button type="button" className="bd-btn bd-btn-dark" onClick={() => { del.reset(); setOpen(true); }}>
        Delete company
      </button>
      {open && (
        <DeleteCompanyModal
          name={brand.brandName}
          busy={del.busy}
          error={del.error}
          onCancel={() => setOpen(false)}
          onConfirm={async () => { if (await del.run()) setOpen(false); }}
        />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const storedBrand = useBrandStore((s) => s.brand);
  const setBrandStore = useBrandStore((s) => s.setBrand);

  const [brand, setBrand] = useState<Brand | null>(storedBrand);
  const [loading, setLoading] = useState(!storedBrand);

  useEffect(() => {
    if (storedBrand) {
      setBrand(storedBrand);
      setLoading(false);
      return;
    }
    apiClient
      .get<{ success: boolean; data: Brand }>("/api/brand")
      .then((res) => {
        if (res.data.success && res.data.data) {
          setBrand(res.data.data);
          setBrandStore(res.data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storedBrand, setBrandStore]);

  function handleLogoChange(newLogoUrl: string | null) {
    if (!brand) return;
    const updated = { ...brand, logoUrl: newLogoUrl };
    setBrand(updated);
    setBrandStore(updated);
    toast.success(newLogoUrl ? "Logo updated successfully!" : "Logo removed.");
  }

  function handleVoiceUpdate(voiceSummary: string) {
    if (!brand) return;
    const updated = { ...brand, voiceSummary };
    setBrand(updated);
    setBrandStore(updated);
    toast.success("Brand voice updated!");
  }

  function handleSaved(next: Brand) {
    setBrand(next);
    setBrandStore(next);
  }

  if (loading) {
    return (
      <div className="bd-center-screen" style={{ minHeight: "50vh", background: "transparent" }}>
        <div className="bd-spinner" />
      </div>
    );
  }

  return (
    <div className="bd-flow">
      <div className="bd-pagehead">
        <div>
          <h1>Settings</h1>
          <p>Manage your brand identity, voice and account.</p>
        </div>
      </div>

      {!brand ? (
        <div className="bd-card">
          <div className="bd-empty">
            <strong>Brand not found</strong>
            Complete onboarding first. <Link href="/brand-setup" className="bd-link" style={{ display: "inline" }}>Set up your brand →</Link>
          </div>
        </div>
      ) : (
        <div className="bd-split">
          <div className="bd-flow">
            <BrandProfileSection key={brand.id + (brand.updatedAt ?? "")} brand={brand} onSaved={handleSaved} />
            <BrandVoiceSection brand={brand} onVoiceUpdate={handleVoiceUpdate} onError={() => toast.error("Failed to regenerate. Please try again.")} />
          </div>
          <div className="bd-flow">
            <AccountSection />
            <LogoSection brand={brand} onLogoChange={handleLogoChange} />
            <DangerSection brand={brand} />
            <div className="bd-card bd-reveal" style={{ background: "var(--tint)", border: 0, boxShadow: "none" }}>
              <div className="bd-tip" style={{ color: "var(--ink-2)" }}>
                <Check size={18} style={{ color: "var(--p)", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <b style={{ display: "block", color: "var(--ink)", marginBottom: 4 }}>How your logo is used</b>
                  When &ldquo;Include brand logo&rdquo; is on in Image Studio, your logo is placed at the bottom-right of every generated image on a subtle white pill, so each post looks branded.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
