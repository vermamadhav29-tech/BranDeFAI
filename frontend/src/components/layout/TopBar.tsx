"use client";

import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import { useBrandStore } from "@/stores/brandStore";
import { useSidebarStore } from "@/stores/sidebarStore";

// ─── Page title map ────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/calendar": "Content Calendar",
  "/images": "Image Studio",
  "/videos": "Video Studio",
  "/instagram": "Instagram",
  "/strategy": "Strategy",
};

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return title;
  }
  return "BranDeFAI";
}

// ─── TopBar ────────────────────────────────────────────────────────────────────

export default function TopBar() {
  const pathname = usePathname();
  const brand = useBrandStore((s) => s.brand);
  const { openMobile } = useSidebarStore();

  const title = getPageTitle(pathname);

  return (
    <header className="h-16 flex items-center justify-between px-5 bg-white border-b border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex-shrink-0 z-10">
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={openMobile}
          className="lg:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-[#1A2E44] transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <h1 className="text-base font-semibold text-[#1A2E44]">{title}</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Brand name pill */}
        {brand && (
          <span className="hidden sm:inline-flex items-center text-xs font-medium text-[#1A7A4A] border border-[#1A7A4A]/30 bg-[#E8F5EE] px-3 py-1 rounded-full">
            {brand.brandName}
          </span>
        )}

        {/* Notification bell */}
        <button
          type="button"
          className="relative p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-[#1A2E44] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}
