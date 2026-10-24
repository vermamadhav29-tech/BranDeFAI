"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { DeleteCompanyModal } from "@/components/features/DeleteCompanyModal";
import { useAuthStore } from "@/stores/authStore";
import { useBrandStore } from "@/stores/brandStore";
import { useWorkspaceStore, BRAND_LIMIT, PRIMARY_BRAND_ID, type WorkspaceBrand } from "@/stores/workspaceStore";

type Draft = Omit<WorkspaceBrand, "id" | "createdAt">;

const EMPTY: Draft = {
  name: "",
  website: "",
  lore: "",
  context: "",
  services: "",
  logoDataUrl: null,
  colors: { primary: "#5235ef", secondary: "#101011", accent: "#8771ff" },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const size = 256;
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="bd-field" style={{ minWidth: 0 }}>
      <label className="bd-label">{label}</label>
      <div className="bd-colorfield">
        <input type="color" value={HEX.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} aria-label={`${label} colour`} />
        <input className="bd-input" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      </div>
    </div>
  );
}

function CompanyModal({ initial, onClose, onSave }: { initial: Draft; onClose: () => void; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setColor = (k: keyof Draft["colors"], v: string) => setD((p) => ({ ...p, colors: { ...p.colors, [k]: v } }));

  async function pickLogo(file: File) {
    try {
      set("logoDataUrl", await resizeLogo(file));
    } catch {
      setError("Couldn't read that image. Try a PNG or JPG.");
    }
  }

  function submit() {
    if (!d.name.trim()) return setError("Give your company a name.");
    if (d.website.trim() && !/^https?:\/\/\S+\.\S+/.test(d.website.trim())) return setError("Website should start with http:// or https://");
    const colors = d.colors;
    if (![colors.primary, colors.secondary, colors.accent].every((c) => HEX.test(c))) return setError("Brand colours must be hex values like #5235ef.");
    onSave({ ...d, name: d.name.trim(), website: d.website.trim() });
  }

  return (
    <div className="bd-modal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label="Company details">
      <div className="bd-modal lg" onClick={(e) => e.stopPropagation()}>
        <div className="bd-modal-hd">
          <h3>{initial.name ? "Edit company" : "Add a company"}</h3>
          <button type="button" className="bd-btn bd-btn-ghost is-icon" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="bd-modal-bd">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <button type="button" className="bd-logo-drop" onClick={() => fileRef.current?.click()} aria-label="Upload logo">
              {d.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.logoDataUrl} alt="Logo" />
              ) : (
                <span>Logo</span>
              )}
            </button>
            <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickLogo(f); e.target.value = ""; }} />
            <div style={{ minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 15 }}>Company logo</b>
              <span className="bd-hint" style={{ margin: 0 }}>PNG, JPG or SVG. Square works best.</span>
              {d.logoDataUrl && (
                <button type="button" className="bd-link" style={{ display: "block", marginTop: 4, background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => set("logoDataUrl", null)}>Remove</button>
              )}
            </div>
          </div>

          <div className="bd-field">
            <label className="bd-label" htmlFor="co-name">Company name</label>
            <input id="co-name" className="bd-input" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Anokhi Label" maxLength={80} />
          </div>

          <div className="bd-field">
            <label className="bd-label" htmlFor="co-site">Website</label>
            <input id="co-site" className="bd-input" type="url" value={d.website} onChange={(e) => set("website", e.target.value)} placeholder="https://yourbrand.com" />
          </div>

          <div className="bd-field">
            <label className="bd-label" htmlFor="co-services">Services &amp; products</label>
            <textarea id="co-services" className="bd-textarea" rows={3} value={d.services} onChange={(e) => set("services", e.target.value)} placeholder="What do you sell or offer? e.g. handwoven silk kurta sets, bridal wear, custom tailoring" maxLength={600} />
          </div>

          <div className="bd-field">
            <label className="bd-label" htmlFor="co-lore">Brand story (lore)</label>
            <textarea id="co-lore" className="bd-textarea" rows={4} value={d.lore} onChange={(e) => set("lore", e.target.value)} placeholder="How did the brand start? What does it stand for? The AI uses this to sound like you." maxLength={1500} />
          </div>

          <div className="bd-field">
            <label className="bd-label" htmlFor="co-ctx">Context for the AI</label>
            <textarea id="co-ctx" className="bd-textarea" rows={3} value={d.context} onChange={(e) => set("context", e.target.value)} placeholder="Audience, tone, things to always or never say, competitors, locations…" maxLength={1500} />
          </div>

          <div>
            <label className="bd-label" style={{ display: "block", marginBottom: 8 }}>Brand colours</label>
            <div className="bd-colors-grid">
              <ColorField label="Primary" value={d.colors.primary} onChange={(v) => setColor("primary", v)} />
              <ColorField label="Secondary" value={d.colors.secondary} onChange={(v) => setColor("secondary", v)} />
              <ColorField label="Accent" value={d.colors.accent} onChange={(v) => setColor("accent", v)} />
            </div>
          </div>

          {error && <p className="bd-field-err" style={{ margin: 0 }} role="alert">{error}</p>}
        </div>

        <div className="bd-modal-ft">
          <button type="button" className="bd-btn bd-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="bd-btn bd-btn-primary" onClick={submit}>Save company</button>
        </div>
      </div>
    </div>
  );
}

function Swatches({ colors }: { colors: Draft["colors"] }) {
  return (
    <span className="bd-swatches" aria-label="Brand colours">
      {[colors.primary, colors.secondary, colors.accent].map((c, i) => <i key={i} style={{ background: c }} />)}
    </span>
  );
}

function CompaniesInner() {
  const router = useRouter();
  const search = useSearchParams();
  const plan = useAuthStore((s) => s.user?.plan ?? "FREE");
  const primary = useBrandStore((s) => s.brand);
  const { brands, activeBrandId, addBrand, updateBrand, removeBrand, setActive } = useWorkspaceStore();

  const [editing, setEditing] = useState<WorkspaceBrand | "new" | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceBrand | null>(null);

  function confirmDelete() {
    if (!deleting) return;
    removeBrand(deleting.id);
    toast.success("Company deleted.");
    setDeleting(null);
  }

  const count = (primary ? 1 : 0) + brands.length;
  const limit = BRAND_LIMIT[plan] ?? 1;
  const locked = count >= limit;

  useEffect(() => {
    if (search.get("new") === "1" && !locked) setEditing("new");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeModal() {
    setEditing(null);
    if (search.get("new")) router.replace("/companies");
  }

  function save(d: Draft) {
    if (editing === "new") {
      addBrand(d);
      toast.success(`${d.name} added and selected.`);
    } else if (editing) {
      updateBrand(editing.id, d);
      toast.success("Company updated.");
    }
    closeModal();
  }

  return (
    <div className="bd-flow">
      <div className="bd-pagehead">
        <div>
          <h1>Companies</h1>
          <p>Manage the brands you create content for, and switch between them from the sidebar.</p>
        </div>
        {locked ? (
          <Link href="/credits" className="bd-btn bd-btn-dark"><Lock size={15} /> Add company</Link>
        ) : (
          <button type="button" className="bd-btn bd-btn-primary" onClick={() => setEditing("new")}><Plus size={15} /> Add company</button>
        )}
      </div>

      {locked && (
        <div className="bd-alert" style={{ background: "var(--tint)", color: "var(--p)" }}>
          <Lock size={18} />
          <span>
            <strong>{plan === "FREE" ? "Multiple companies are a paid feature." : "You've reached your plan's company limit."}</strong>{" "}
            {plan === "FREE" ? "Upgrade to manage more than one brand." : `Your plan includes ${limit} companies.`}
          </span>
          <Link href="/credits" className="bd-link">See plans</Link>
        </div>
      )}

      <div className="bd-grid-3">
        {primary && (
          <div className={"bd-card bd-company" + (activeBrandId === PRIMARY_BRAND_ID ? " is-active" : "")}>
            <div className="bd-company-top">
              <span className="bd-bs-mark" style={{ width: 52, height: 52, borderRadius: 16, fontSize: 20 }}>
                {primary.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={primary.logoUrl} alt="" />
                ) : (
                  primary.brandName[0]?.toUpperCase()
                )}
              </span>
              <span className="bd-chip g">Main</span>
            </div>
            <h3>{primary.brandName}</h3>
            <p className="bd-card-sub" style={{ margin: 0 }}>{primary.industry}</p>
            <div className="bd-company-actions">
              <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" disabled={activeBrandId === PRIMARY_BRAND_ID} onClick={() => setActive(PRIMARY_BRAND_ID)}>
                {activeBrandId === PRIMARY_BRAND_ID ? "Selected" : "Switch to"}
              </button>
              <Link href="/settings" className="bd-btn bd-btn-primary bd-btn-sm">Settings</Link>
            </div>
          </div>
        )}

        {brands.map((b) => (
          <div key={b.id} className={"bd-card bd-company" + (activeBrandId === b.id ? " is-active" : "")}>
            <div className="bd-company-top">
              <span className="bd-bs-mark" style={{ width: 52, height: 52, borderRadius: 16, fontSize: 20 }}>
                {b.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logoDataUrl} alt="" />
                ) : (
                  b.name[0]?.toUpperCase()
                )}
              </span>
              <Swatches colors={b.colors} />
            </div>
            <h3>{b.name}</h3>
            <p className="bd-card-sub" style={{ margin: 0 }}>{b.website || b.services || "No details yet"}</p>
            <div className="bd-company-actions">
              <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" disabled={activeBrandId === b.id} onClick={() => setActive(b.id)}>
                {activeBrandId === b.id ? "Selected" : "Switch to"}
              </button>
              <button type="button" className="bd-btn bd-btn-primary bd-btn-sm" onClick={() => setEditing(b)}>Edit</button>
              <button
                type="button"
                className="bd-btn bd-btn-ghost is-icon"
                aria-label={`Delete ${b.name}`}
                onClick={() => setDeleting(b)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {!primary && brands.length === 0 && (
          <div className="bd-empty" style={{ gridColumn: "1 / -1" }}>
            <strong>No companies yet</strong>
            <Link href="/brand-setup" className="bd-link" style={{ display: "inline-flex" }}>Set up your first brand →</Link>
          </div>
        )}
      </div>

      <div className="bd-card" style={{ background: "var(--bg)", boxShadow: "none" }}>
        <p className="bd-card-sub" style={{ margin: 0, display: "flex", gap: 10 }}>
          <Check size={17} style={{ flexShrink: 0, marginTop: 2, color: "var(--green)" }} />
          <span>
            Extra companies are saved in this browser for now, and content generation still uses your main brand. Full
            multi-company generation is coming soon.
          </span>
        </p>
      </div>

      {deleting && (
        <DeleteCompanyModal name={deleting.name} busy={false} error={null} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
      )}

      {editing && (
        <CompanyModal
          initial={editing === "new" ? EMPTY : { name: editing.name, website: editing.website, lore: editing.lore, context: editing.context, services: editing.services, logoDataUrl: editing.logoDataUrl, colors: editing.colors }}
          onClose={closeModal}
          onSave={save}
        />
      )}
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={null}>
      <CompaniesInner />
    </Suspense>
  );
}
