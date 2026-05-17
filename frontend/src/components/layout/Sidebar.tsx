"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Palette, Target, Calendar, Image, Video, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brand-setup", label: "Brand Setup", icon: Palette },
  { href: "/strategy", label: "Strategy", icon: Target },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/images", label: "Images", icon: Image },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/instagram", label: "Instagram", icon: Share2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <span className="text-xl font-bold text-[#1A2E44]">BranDe<span className="text-[#1A7A4A]">FAI</span></span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-[#E8F5EE] text-[#1A7A4A]"
                : "text-gray-600 hover:bg-gray-50 hover:text-[#1A2E44]"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
