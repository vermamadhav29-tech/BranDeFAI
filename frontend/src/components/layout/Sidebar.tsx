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

const PLAN_BADGE: Record<PlanKey, { bg: string; text: string; label: string }> = {
  FREE:     { bg: "bg-gray-100",   text: "text-gray-500",   label: "Free" },
  PRO:      { bg: "bg-[#E8F5EE]", text: "text-[#1A7A4A]",  label: "Pro" },
  BUSINESS: { bg: "bg-amber-50",  text: "text-amber-600",   label: "Business" },
};

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

// ─── Keyboard shortcuts ────────────────────────────────────────────────────────

function useNavShortcuts(router: ReturnType<typeof useRouter>) {
  const pendingRef = useRef<string | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;

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

// ─── Credit Ring ───────────────────────────────────────────────────────────────

function CreditRing({
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
  const R    = 28;
  const CIRC = 2 * Math.PI * R;
  const pct  = max > 0 ? Math.min(safeBalance / max, 1) : 0;
  const offset = CIRC * (1 - pct);

  const isCritical = pct < 0.1;
  const isAmber    = pct >= 0.1 && pct < 0.3;
  const strokeColor = isCritical ? "#EF4444" : isAmber ? "#D97706" : "#1A7A4A";

  if (collapsed) {
    return (
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
        style={{ background: "linear-gradient(135deg, #1A7A4A, #065F46)" }}
        title={`${safeBalance} credits remaining`}
      >
        {safeBalance > 99 ? "99+" : safeBalance}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <div className="relative w-[68px] h-[68px] flex items-center justify-center">
        <svg
          width="68"
          height="68"
          viewBox="0 0 72 72"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx="36" cy="36" r={R}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="5"
          />
          {/* Animated fill */}
          <motion.circle
            cx="36" cy="36" r={R}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            stroke={strokeColor}
            initial={{ strokeDashoffset: CIRC }}
            animate={{
              strokeDashoffset: offset,
              ...(isCritical ? { opacity: [1, 0.3, 1] } : { opacity: 1 }),
            }}
            transition={{
              strokeDashoffset: { duration: 1.2, ease: "easeOut" },
              opacity: isCritical
                ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0 },
            }}
            style={{ transition: "stroke 0.35s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[17px] font-bold text-[#1A2E44] leading-none">
            {safeBalance}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-gray-400">credits remaining</p>

      {isCritical && (
        <p className="text-[10px] font-semibold text-red-500">⚠ Very low!</p>
      )}
      {isAmber && (
        <p className="text-[10px] font-semibold text-amber-600">Running low</p>
      )}

      <Link
        href="/credits"
        className="text-[10px] text-[#1A7A4A] hover:underline mt-0.5"
      >
        Get More Credits
      </Link>
    </div>
  );
}

// ─── User avatar ───────────────────────────────────────────────────────────────

function UserAvatar({ email }: { email: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 select-none"
      style={{ background: "linear-gradient(135deg, #1A7A4A, #065F46)" }}
    >
      {email[0].toUpperCase()}
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

  // Refresh credits balance on every navigation so the ring stays current
  const refreshCredits = useCallback(() => {
    if (!useAuthStore.getState().isAuthenticated) return;
    apiClient
      .get<{ success: boolean; data: { creditsBalance: number } }>("/api/credits/balance")
      .then((res) => {
        if (res.data.success && res.data.data != null) {
          const bal = res.data.data.creditsBalance;
          console.log(`[Sidebar] credits refresh — creditsBalance=${bal}`);
          updateCredits(bal);
        }
      })
      .catch(() => { /* non-critical */ });
  }, [updateCredits]);

  useEffect(() => {
    refreshCredits();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
  const badge   = PLAN_BADGE[planKey];

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn(
        "flex flex-col bg-white border-r border-gray-100 h-full flex-shrink-0 overflow-hidden",
        "hidden lg:flex relative",
        isMobileOpen && "!flex fixed inset-y-0 left-0 z-50 shadow-2xl"
      )}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="h-16 flex items-center border-b border-gray-100 flex-shrink-0 px-4 overflow-hidden">
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
              <Link href="/" className="text-lg font-extrabold text-[#1A7A4A]">
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
                <div className="text-[17px] font-bold text-[#1A2E44] leading-none whitespace-nowrap group-hover:opacity-80 transition-opacity">
                  BranDe<span className="text-[#1A7A4A]">FAI</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 font-medium tracking-wide whitespace-nowrap">
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
                className={cn(
                  "relative",
                  isCollapsed ? "flex justify-center" : "block"
                )}
                whileHover="hovered"
                initial="rest"
                animate="rest"
              >
                <Link
                  href={href}
                  onClick={closeMobile}
                  title={isCollapsed ? label : undefined}
                  className={cn(
                    "relative flex items-center text-sm font-medium rounded-lg overflow-hidden",
                    isCollapsed
                      ? "justify-center w-10 h-10"
                      : "gap-3 px-3 py-2.5 w-full",
                    active ? "text-[#1A7A4A]" : "text-gray-500"
                  )}
                >
                  {/* Active background — slides between items via layoutId */}
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to right, #E8F5EE, transparent)",
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    >
                      {/* Left accent border lives inside the animated div */}
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#1A7A4A]" />
                    </motion.div>
                  )}

                  {/* Hover background (variant-propagated from parent motion.div) */}
                  <motion.div
                    variants={{
                      hovered: { opacity: active ? 0 : 1 },
                      rest:    { opacity: 0 },
                    }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 bg-[#F5F7F9]"
                  />

                  {/* Icon — scales on hover via variant propagation */}
                  <motion.span
                    variants={{ hovered: { scale: 1.1 }, rest: { scale: 1 } }}
                    transition={{ duration: 0.15 }}
                    className="relative z-10 shrink-0"
                  >
                    <Icon size={18} />
                  </motion.span>

                  {/* Label + shortcut + active dot (hidden when collapsed) */}
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
                          {/* Keyboard shortcut — fades in on hover */}
                          {shortcut && (
                            <motion.span
                              variants={{
                                hovered: { opacity: 1 },
                                rest:    { opacity: 0 },
                              }}
                              transition={{ duration: 0.15 }}
                              className="text-[10px] text-gray-300 font-mono"
                            >
                              {shortcut}
                            </motion.span>
                          )}

                          {/* Active dot — springs in */}
                          {active && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 15,
                              }}
                              className="w-1.5 h-1.5 rounded-full bg-[#1A7A4A] shrink-0"
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
      <div className="border-t border-gray-100 pb-4">
        {/* Credit widget */}
        {user && (
          <div
            className={cn(
              "pt-4",
              isCollapsed ? "flex justify-center px-2" : "px-4"
            )}
          >
            <CreditRing
              balance={user.creditsBalance}
              plan={user.plan}
              collapsed={isCollapsed}
            />
          </div>
        )}

        {/* User section */}
        {user && (
          <motion.div
            className={cn(
              "relative mt-3 mx-2 rounded-xl cursor-default",
              isCollapsed ? "flex justify-center p-2" : "px-3 py-2.5"
            )}
            onHoverStart={() => setUserHovered(true)}
            onHoverEnd={() => setUserHovered(false)}
          >
            {/* Hover bg */}
            <motion.div
              className="absolute inset-0 rounded-xl bg-gray-50 pointer-events-none"
              animate={{ opacity: userHovered && !isCollapsed ? 1 : 0 }}
              transition={{ duration: 0.15 }}
            />

            {isCollapsed ? (
              <UserAvatar email={user.email} />
            ) : (
              <div className="relative flex items-center gap-2.5 min-w-0">
                <UserAvatar email={user.email} />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[11px] text-gray-500 font-medium truncate"
                    title={user.email}
                  >
                    {user.email}
                  </p>
                  <span
                    className={cn(
                      "inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      badge.bg,
                      badge.text
                    )}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Settings icon — appears on hover */}
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
                        className="text-gray-400 hover:text-[#1A2E44] transition-colors"
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
        <div
          className={cn(
            "mt-1",
            isCollapsed ? "flex justify-center px-2" : "px-2"
          )}
        >
          <button
            type="button"
            onClick={handleLogout}
            title={isCollapsed ? "Log out" : undefined}
            className={cn(
              "flex items-center rounded-lg text-sm font-medium text-gray-400",
              "hover:bg-red-50 hover:text-red-500 transition-colors",
              isCollapsed ? "justify-center w-10 h-10" : "w-full gap-3 px-3 py-2"
            )}
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
          "absolute top-[18px] -right-3 w-6 h-6 rounded-full bg-white border border-gray-200",
          "items-center justify-center shadow-sm hover:shadow transition-shadow",
          "text-gray-400 hover:text-[#1A7A4A] z-10",
          "hidden lg:flex"
        )}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
