"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Image as ImageIcon,
  Film,
  Share2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
  Lightbulb,
  Layers,
  Zap,
  X,
  Building2,
} from "lucide-react";
import Brand from "@/components/draftr/Brand";
import BrandSwitcher from "@/components/layout/BrandSwitcher";
import { useAuthStore } from "@/stores/authStore";
import { useBrandStore } from "@/stores/brandStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import apiClient from "@/lib/apiClient";

// ─── Data ──────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Create",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
      { href: "/strategy", label: "Strategy", icon: Lightbulb },
      { href: "/content", label: "Generated Content", icon: Layers },
      { href: "/images", label: "Image Studio", icon: ImageIcon, shortcut: "G I" },
      { href: "/videos", label: "Video Studio", icon: Film },
    ],
  },
  {
    label: "Plan & publish",
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays, shortcut: "G C" },
      { href: "/social-accounts", label: "Social accounts", icon: Share2 },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/credits", label: "Credits & billing", icon: Zap },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const PLAN_MAX = { FREE: 50, PRO: 500, BUSINESS: 2000 } as const;
type PlanKey = keyof typeof PLAN_MAX;
const PLAN_LABEL: Record<PlanKey, string> = { FREE: "Free", PRO: "Pro", BUSINESS: "Business" };

// ─── Keyboard shortcuts ────────────────────────────────────────────────────────

function useNavShortcuts(router: ReturnType<typeof useRouter>) {
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const key = e.key.toUpperCase();
      if (pendingRef.current === "G") {
        if (timerRef.current) clearTimeout(timerRef.current);
        pendingRef.current = null;
        if (key === "D") { router.push("/dashboard"); return; }
        if (key === "C") { router.push("/calendar"); return; }
        if (key === "I") { router.push("/images"); return; }
        return;
      }
      if (key === "G") {
        pendingRef.current = "G";
        timerRef.current = setTimeout(() => { pendingRef.current = null; }, 1500);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

// ─── Credits card ──────────────────────────────────────────────────────────────

function CreditsCard({ balance, plan, compact }: { balance: number | undefined; plan: string; compact: boolean }) {
  const safeBalance = balance ?? 0;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("bd-credits-card-hidden") === "1");
    } catch { /* storage unavailable */ }
  }, []);
  const max = PLAN_MAX[plan as PlanKey] ?? 50;
  const pct = max > 0 ? Math.min(safeBalance / max, 1) : 0;

  if (compact) {
    return (
      <Link href="/credits" className="bd-credit-mini" title={`${safeBalance} credits remaining`}>
        {safeBalance > 99 ? "99+" : safeBalance}
      </Link>
    );
  }

  if (hidden) return null;

  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1, 1);
  const resetsDate = nextReset.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="bd-credit-card">
      <div className="bd-credit-top">
        <Zap size={14} />
        <span>Credits</span>
        <button
          type="button"
          className="bd-credit-x"
          aria-label="Hide credits card"
          title="Hide"
          onClick={() => {
            setHidden(true);
            try { localStorage.setItem("bd-credits-card-hidden", "1"); } catch { /* ignore */ }
          }}
        >
          <X size={14} />
        </button>
      </div>
      <p className="bd-credit-num" style={{ margin: "6px 0 10px" }}>
        {safeBalance.toLocaleString()} <small>/ {max.toLocaleString()}</small>
      </p>
      <div className={"bd-bar" + (pct < 0.2 ? " is-low" : "")}>
        <span style={{ width: `${Math.max(pct * 100, 2)}%` }} />
      </div>
      <p className="bd-credit-sub">
        {PLAN_LABEL[plan as PlanKey] ?? "Free"} plan · resets {resetsDate}
      </p>
      <Link href="/credits" className="bd-credit-cta">
        {plan === "FREE" ? "Upgrade plan" : "Buy credits"}
      </Link>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useIsDesktop();

  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const updateCredits = useAuthStore((s) => s.updateCredits);
  const clearBrand = useBrandStore((s) => s.clearBrand);

  const { isCollapsed, isMobileOpen, toggleCollapse, closeMobile } = useSidebarStore();
  const compact = isCollapsed && isDesktop;

  useNavShortcuts(router);

  const refreshCredits = useCallback(() => {
    if (!useAuthStore.getState().isAuthenticated) return;
    apiClient
      .get<{ success: boolean; data: { creditsBalance: number } }>("/api/credits/balance")
      .then((res) => {
        if (res.data.success && res.data.data != null) updateCredits(res.data.data.creditsBalance);
      })
      .catch(() => {});
  }, [updateCredits]);

  useEffect(() => { refreshCredits(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // close the mobile drawer when the route changes
  useEffect(() => { closeMobile(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    try { await apiClient.post("/api/auth/logout"); } catch { /* proceed */ }
    clearUser();
    clearBrand();
    router.push("/login");
  }

  const planKey = (user?.plan as PlanKey) ?? "FREE";

  return (
    <aside className={"bd-side" + (compact ? " is-compact" : "") + (isMobileOpen ? " is-open" : "")} aria-label="Main navigation">
      {/* logo — full page load so marketing styles never mix into the app */}
      <div className="bd-side-logo">
        <a href="/" aria-label="BrandefAI home" style={{ height: "100%", display: "flex" }}>
          <Brand size={compact ? 20 : 22} markOnly={compact} />
        </a>
      </div>

      <BrandSwitcher compact={compact} onNavigate={closeMobile} />

      <nav className="bd-side-nav">
        {NAV_GROUPS.map((group) => (
          <div className="bd-side-group" key={group.label}>
            <p className="bd-side-label">{group.label}</p>
            {group.items.map(({ href, label, icon: Icon, shortcut }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMobile}
                  title={compact ? label : undefined}
                  className={"bd-nav-item" + (active ? " is-active" : "")}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={19} strokeWidth={active ? 2.2 : 1.9} />
                  {!compact && (
                    <>
                      <span className="bd-nav-text">{label}</span>
                      {shortcut && <span className="bd-kbd">{shortcut}</span>}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="bd-side-bottom">
        {user && <CreditsCard balance={user.creditsBalance} plan={user.plan} compact={compact} />}

        <div className="bd-user-row">
          {user && (
            <Link href="/settings" className="bd-user" onClick={closeMobile} title={compact ? user.email : undefined}>
              <div className="bd-avatar">{user.email[0]}</div>
              {!compact && (
                <div className="bd-user-meta">
                  <p className="bd-user-email" title={user.email}>{user.email}</p>
                  <span className="bd-user-plan">{PLAN_LABEL[planKey] ?? "Free"} plan</span>
                </div>
              )}
            </Link>
          )}
          <button type="button" onClick={handleLogout} className="bd-logout" title="Log out" aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <button type="button" onClick={toggleCollapse} className="bd-collapse" aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}
