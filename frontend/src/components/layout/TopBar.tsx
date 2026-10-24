"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Plus, Zap, ImageIcon, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useBrandOptions } from "@/hooks/useActiveBrand";
import { useSidebarStore } from "@/stores/sidebarStore";
import apiClient from "@/lib/apiClient";

// ─── Page title map ────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/strategy": "Brand strategy",
  "/content": "Generated content",
  "/calendar": "Content calendar",
  "/images": "Image studio",
  "/videos": "Video studio",
  "/social-accounts": "Social accounts",
  "/companies": "Companies",
  "/credits": "Credits & billing",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return title;
  }
  return "BrandefAI";
}

// ─── TopBar ────────────────────────────────────────────────────────────────────

export default function TopBar() {
  const pathname = usePathname();
  const { active: brand } = useBrandOptions();
  const user = useAuthStore((s) => s.user);
  const { openMobile } = useSidebarStore();

  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // posts waiting for the user's approval → notification badge
  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: { total?: number; posts?: unknown[] } }>("/api/creative/posts?status=PENDING_APPROVAL&limit=1")
      .then((r) => {
        if (r.data.success) setPending(r.data.data?.total ?? r.data.data?.posts?.length ?? 0);
      })
      .catch(() => {});
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const title = getPageTitle(pathname);
  const initial = (brand?.name ?? user?.email ?? "B")[0];

  return (
    <div className="bd-top-wrap">
      <header className="bd-top">
        <div className="bd-top-left">
          <button type="button" onClick={openMobile} aria-label="Open menu" className="bd-icon-btn bd-menu-btn">
            <Menu size={20} />
          </button>
          <h1 className="bd-top-title">{title}</h1>
        </div>

        <div className="bd-top-right">
          <Link href="/content" className="bd-btn bd-btn-primary bd-btn-sm" style={{ display: undefined }}>
            <Plus size={16} /> New post
          </Link>

          <Link href="/credits" className="bd-pill is-credits" title="Credits remaining">
            <Zap size={15} />
            {(user?.creditsBalance ?? 0).toLocaleString()}
          </Link>

          {brand && (
            <span className="bd-pill is-brand">
              <span className="bd-mini-mark">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="" />
                ) : (
                  initial.toUpperCase()
                )}
              </span>
              {brand.name}
            </span>
          )}

          <div className="bd-pop-wrap" ref={popRef}>
            <button type="button" aria-label="Notifications" className="bd-icon-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              <Bell size={18} />
              {pending > 0 && <span className="bd-dot">{pending > 9 ? "9+" : pending}</span>}
            </button>
            {open && (
              <div className="bd-pop" role="dialog" aria-label="Notifications">
                <div className="bd-pop-head">Notifications</div>
                {pending > 0 ? (
                  <Link href="/images" className="bd-pop-item">
                    <span className="ico" style={{ background: "var(--tint)", color: "var(--p)" }}>
                      <ImageIcon size={18} />
                    </span>
                    <span>
                      <b style={{ display: "block", fontWeight: 600 }}>
                        {pending} post{pending === 1 ? "" : "s"} waiting for approval
                      </b>
                      <span style={{ color: "var(--gray)", fontSize: 13 }}>Review and approve them in Image Studio</span>
                    </span>
                  </Link>
                ) : (
                  <div className="bd-pop-empty">
                    <CheckCircle2 size={22} style={{ color: "var(--green)", marginBottom: 6 }} />
                    <div>You&apos;re all caught up.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
