"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusSquare, CalendarDays, User } from "lucide-react";

const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/images",    icon: PlusSquare,      label: "Create" },
  { href: "/calendar",  icon: CalendarDays,    label: "Calendar" },
  { href: "/settings",  icon: User,            label: "Account" },
] as const;

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden flex items-stretch"
      style={{
        height: 64,
        background: "var(--sidebar-bg)",
        borderTop: "1px solid var(--sidebar-border)",
      }}
    >
      {TABS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: active ? "var(--primary)" : "var(--text-muted)" }}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[10px] font-medium">{label}</span>
            {active && (
              <span
                className="absolute bottom-1 w-1 h-1 rounded-full"
                style={{ background: "var(--primary)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
