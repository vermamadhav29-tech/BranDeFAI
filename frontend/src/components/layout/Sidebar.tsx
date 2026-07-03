"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  LayoutDashboard,
  CalendarDays,
  Image,
  Film,
  Share2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
  Lightbulb,
  Layers,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard",        icon: LayoutDashboard, shortcut: "G D" },
  { href: "/strategy",  label: "Strategy",          icon: Lightbulb },
  { href: "/content",   label: "Generated Content", icon: Layers },
  { href: "/calendar",  label: "Calendar",          icon: CalendarDays,    shortcut: "G C" },
  { href: "/images",    label: "Image Studio",      icon: Image,           shortcut: "G I" },
  { href: "/videos",    label: "Video Studio",      icon: Film },
  { href: "/instagram", label: "Instagram",         icon: Share2 },
  { href: "/credits",   label: "Credits",           icon: Zap },
  { href: "/settings",  label: "Settings",          icon: Settings },
];

const PLAN_MAX = { FREE: 50, PRO: 500, BUSINESS: 2000 } as const;
type PlanKey = keyof typeof PLAN_MAX;

const PLAN_BADGE: Record<PlanKey, { label: string }> = {
  FREE:     { label: "Free" },
  PRO:      { label: "Pro" },
  BUSINESS: { label: "Business" },
};

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

// ─── Keyboard shortcuts ────────────────────────────────────────────────────────

function useNavShortcuts(router: ReturnType<typeof useRouter>) {
  const pendingRef = useRef<string | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const key = e.key.toUpperCase();
      if (pendingRef.current === "G") {
        if (timerRef.current) clearTimeout(timerRef.current);
        pendingRef.current = null;
        if (key === "D") { router.push("/dashboard"); return; }
        if (key === "C") { router.push("/calendar");  return; }
        if (key === "I") { router.push("/images");    return; }
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

// ─── User avatar ───────────────────────────────────────────────────────────────

function UserAvatar({ email }: { email: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 select-none"
      style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-btn-hover))" }}
    >
      {email[0].toUpperCase()}
    </div>
  );
}

// ─── Credits card ──────────────────────────────────────────────────────────────

function CreditsCard({
  balance,
  plan,
  collapsed,
}: {
  balance: number | undefined;
  plan: string;
  collapsed: boolean;
}) {
  const safeBalance = balance ?? 0;
  const max = PLAN_MAX[(plan as PlanKey)] ?? 50;
  const pct = max > 0 ? Math.min(safeBalance / max, 1) : 0;

  if (collapsed) {
    return (
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-btn-hover))" }}
        title={`${safeBalance} credits remaining`}
      >
        {safeBalance > 99 ? "99+" : safeBalance}
      </div>
    );
  }

  const planKey = (plan as PlanKey);
  const badge   = PLAN_BADGE[planKey] ?? PLAN_BADGE.FREE;
  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1, 1);
  const resetsDate = nextReset.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap size={14} style={{ color: "var(--accent-amber)" }} />
        <span className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Credits</span>
      </div>

      <p className="text-[28px] font-bold leading-none mb-1" style={{ color: "var(--text-primary)" }}>
        {safeBalance}
      </p>

      {/* Progress bar */}
      <div className="w-full h-1 rounded-full mb-2" style={{ background: "var(--border-color)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(4, pct * 100)}%`,
            background: pct < 0.15 ? "#EF4444" : pct < 0.3 ? "var(--accent-amber)" : "var(--primary)",
          }}
        />
      </div>

      <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
        {badge.label} plan · resets {resetsDate}
      </p>

      <Link
        href="/credits"
        className="inline-flex items-center text-[12px] font-semibold rounded-lg px-3 py-1 transition-all"
        style={{
          color: "var(--primary)",
          border: "1px solid var(--primary)",
          background: "var(--primary-glow)",
        }}
      >
        Upgrade
      </Link>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const user          = useAuthStore((s) => s.user);
  const clearUser     = useAuthStore((s) => s.clearUser);
  const updateCredits = useAuthStore((s) => s.updateCredits);
  const clearBrand    = useBrandStore((s) => s.clearBrand);

  const { isCollapsed, isMobileOpen, setCollapsed, toggleCollapse, closeMobile } =
    useSidebarStore();

  const [userHovered, setUserHovered] = useState(false);

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

  useEffect(() => {
    function onResize() { setCollapsed(window.innerWidth < 1024); }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setCollapsed]);

  async function handleLogout() {
    try { await apiClient.post("/api/auth/logout"); } catch { /* proceed */ }
    clearUser();
    clearBrand();
    router.push("/login");
  }

  const planKey = (user?.plan as PlanKey) ?? "FREE";

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn(
        "flex flex-col h-full flex-shrink-0 overflow-hidden",
        "hidden lg:flex relative",
        isMobileOpen && "!flex fixed inset-y-0 left-0 z-50 shadow-2xl"
      )}
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div
        className="h-16 flex items-center flex-shrink-0 px-4 overflow-hidden"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isCollapsed ? (
            <motion.span
              key="mono"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mx-auto"
            >
              <Link href="/" className="text-lg font-extrabold" style={{ color: "var(--primary)" }}>
                B
              </Link>
            </motion.span>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Link href="/" className="group">
                <div className="text-[17px] font-bold leading-none whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                  BranDe<span style={{ color: "var(--primary)" }}>FAI</span>
                </div>
                <div className="text-[10px] mt-0.5 font-medium tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                  AI Marketing
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        <LayoutGroup id="sidebar-nav">
          {NAV_ITEMS.map(({ href, label, icon: Icon, shortcut }) => {
            const active = pathname === href || pathname.startsWith(href + "/");

            return (
              <motion.div
                key={href}
                className={cn("relative", isCollapsed ? "flex justify-center" : "block")}
                whileHover="hovered"
                initial="rest"
                animate="rest"
              >
                <Link
                  href={href}
                  onClick={closeMobile}
                  title={isCollapsed ? label : undefined}
                  className={cn(
                    "relative flex items-center text-[13px] font-medium rounded-lg overflow-hidden transition-colors",
                    isCollapsed ? "justify-center w-10 h-10" : "gap-[10px] px-3 h-10 w-full"
                  )}
                  style={{ color: active ? "var(--primary)" : "var(--text-secondary)" }}
                >
                  {/* Active background */}
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0"
                      style={{ background: "var(--primary-glow)" }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px]"
                        style={{
                          background: "var(--primary)",
                          borderRadius: "0 8px 8px 0",
                        }}
                      />
                    </motion.div>
                  )}

                  {/* Hover background */}
                  <motion.div
                    variants={{ hovered: { opacity: active ? 0 : 1 }, rest: { opacity: 0 } }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "var(--bg-card-hover)" }}
                  />

                  {/* Icon */}
                  <motion.span
                    variants={{ hovered: { scale: 1.1 }, rest: { scale: 1 } }}
                    transition={{ duration: 0.15 }}
                    className="relative z-10 shrink-0"
                  >
                    <Icon size={18} />
                  </motion.span>

                  {/* Label */}
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        key="label"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="relative z-10 flex-1 flex items-center justify-between min-w-0"
                      >
                        <span className="truncate">{label}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {shortcut && (
                            <motion.span
                              variants={{ hovered: { opacity: 1 }, rest: { opacity: 0 } }}
                              transition={{ duration: 0.15 }}
                              className="text-[10px] font-mono"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {shortcut}
                            </motion.span>
                          )}
                          {active && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 400, damping: 15 }}
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: "var(--primary)" }}
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
              </motion.div>
            );
          })}
        </LayoutGroup>
      </nav>

      {/* ── Bottom section ────────────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--sidebar-border)" }} className="pb-4">
        {/* Credits widget */}
        {user && (
          <div className={cn("pt-4", isCollapsed ? "flex justify-center px-2" : "px-3")}>
            <CreditsCard balance={user.creditsBalance} plan={user.plan} collapsed={isCollapsed} />
          </div>
        )}

        {/* User section */}
        {user && (
          <motion.div
            className={cn("relative mt-3 mx-2 rounded-xl cursor-default", isCollapsed ? "flex justify-center p-2" : "px-3 py-2.5")}
            onHoverStart={() => setUserHovered(true)}
            onHoverEnd={() => setUserHovered(false)}
          >
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ background: "var(--bg-card-hover)" }}
              animate={{ opacity: userHovered && !isCollapsed ? 1 : 0 }}
              transition={{ duration: 0.15 }}
            />

            {isCollapsed ? (
              <UserAvatar email={user.email} />
            ) : (
              <div className="relative flex items-center gap-2.5 min-w-0">
                <UserAvatar email={user.email} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate" style={{ color: "var(--text-secondary)" }} title={user.email}>
                    {user.email}
                  </p>
                  <span
                    className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--primary-glow)", color: "var(--primary)" }}
                  >
                    {PLAN_BADGE[planKey]?.label ?? "Free"}
                  </span>
                </div>

                <AnimatePresence>
                  {userHovered && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15 }}
                      className="relative shrink-0"
                    >
                      <Link
                        href="/settings"
                        onClick={closeMobile}
                        style={{ color: "var(--text-muted)" }}
                        title="Settings"
                      >
                        <Settings size={14} />
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {/* Logout */}
        <div className={cn("mt-1", isCollapsed ? "flex justify-center px-2" : "px-2")}>
          <button
            type="button"
            onClick={handleLogout}
            title={isCollapsed ? "Log out" : undefined}
            className={cn(
              "flex items-center rounded-lg text-sm font-medium transition-colors",
              "hover:bg-red-50 hover:text-red-500",
              isCollapsed ? "justify-center w-10 h-10" : "w-full gap-3 px-3 py-2"
            )}
            style={{ color: "var(--text-muted)" }}
          >
            <LogOut size={16} className="shrink-0" />
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.span
                  key="logout-label"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  Log out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* ── Collapse toggle ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggleCollapse}
        className={cn(
          "absolute top-[18px] -right-3 w-6 h-6 rounded-full",
          "items-center justify-center shadow-sm hover:shadow transition-shadow",
          "hidden lg:flex z-10"
        )}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          color: "var(--text-muted)",
        }}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
