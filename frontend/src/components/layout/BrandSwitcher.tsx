"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Lock, Plus } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaceStore, BRAND_LIMIT } from "@/stores/workspaceStore";
import { useBrandOptions, type BrandOption } from "@/hooks/useActiveBrand";

function Mark({ brand, size = 32 }: { brand: BrandOption; size?: number }) {
  return (
    <span className="bd-bs-mark" style={{ width: size, height: size }}>
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt="" />
      ) : (
        (brand.name[0] ?? "B").toUpperCase()
      )}
    </span>
  );
}

export default function BrandSwitcher({ compact, onNavigate }: { compact: boolean; onNavigate: () => void }) {
  const plan = useAuthStore((s) => s.user?.plan ?? "FREE");
  const setActive = useWorkspaceStore((s) => s.setActive);
  const { options, active } = useBrandOptions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const limit = BRAND_LIMIT[plan] ?? 1;
  const locked = options.length >= limit;

  if (!active) {
    return (
      <Link href="/brand-setup" className="bd-bs-btn" onClick={onNavigate} title="Add your company">
        <span className="bd-bs-mark"><Plus size={16} /></span>
        {!compact && <span className="bd-bs-text"><b>Add your company</b><span>Set up your brand</span></span>}
      </Link>
    );
  }

  return (
    <div className="bd-bs" ref={ref}>
      <button type="button" className="bd-bs-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox" title={compact ? active.name : undefined}>
        <Mark brand={active} />
        {!compact && (
          <>
            <span className="bd-bs-text">
              <b>{active.name}</b>
              <span>{options.length > 1 ? `${options.length} companies` : "Your company"}</span>
            </span>
            <ChevronsUpDown size={16} className="bd-bs-chev" />
          </>
        )}
      </button>

      {open && (
        <div className="bd-bs-menu" role="listbox">
          <p className="bd-eyebrow" style={{ margin: "4px 10px 6px" }}>Switch company</p>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === active.id}
              className={"bd-bs-item" + (o.id === active.id ? " is-on" : "")}
              onClick={() => { setActive(o.id); setOpen(false); }}
            >
              <Mark brand={o} size={28} />
              <span className="bd-bs-name">{o.name}</span>
              {o.id === active.id && <Check size={16} />}
            </button>
          ))}
          <div className="bd-bs-sep" />
          {locked ? (
            <Link href="/credits" className="bd-bs-item" onClick={() => { setOpen(false); onNavigate(); }}>
              <span className="bd-bs-mark is-ghost"><Lock size={14} /></span>
              <span className="bd-bs-name">Add company</span>
              <span className="bd-chip p" style={{ height: 20, padding: "0 8px", fontSize: 11 }}>{plan === "FREE" ? "Pro" : "Limit"}</span>
            </Link>
          ) : (
            <Link href="/companies?new=1" className="bd-bs-item" onClick={() => { setOpen(false); onNavigate(); }}>
              <span className="bd-bs-mark is-ghost"><Plus size={16} /></span>
              <span className="bd-bs-name">Add company</span>
            </Link>
          )}
          <Link href="/companies" className="bd-bs-item" onClick={() => { setOpen(false); onNavigate(); }}>
            <span className="bd-bs-name" style={{ paddingLeft: 38, color: "var(--gray)" }}>Manage companies</span>
          </Link>
        </div>
      )}
    </div>
  );
}
