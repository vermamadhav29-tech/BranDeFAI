"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusSquare, CalendarDays, User } from "lucide-react";

const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/images", icon: PlusSquare, label: "Create" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/settings", icon: User, label: "Account" },
] as const;

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="bd-tabs" aria-label="Quick navigation">
      {TABS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} className={"bd-tab" + (active ? " is-active" : "")} aria-current={active ? "page" : undefined}>
            <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
