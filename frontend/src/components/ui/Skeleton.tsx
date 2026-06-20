import type React from "react";
import { cn } from "@/lib/utils";

// ─── Base ──────────────────────────────────────────────────────────────────────

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("skeleton-shimmer rounded-lg", className)} style={style} />;
}

// ─── StatCardSkeleton ──────────────────────────────────────────────────────────
// Matches the shape of the StatCard: icon circle top-right, label, large value,
// sub-text, sparkline area, accent progress bar at bottom edge.

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 relative overflow-hidden min-h-[136px]">
      {/* Icon circle — top right */}
      <Skeleton className="absolute top-4 right-4 w-11 h-11 rounded-xl" />

      {/* Label */}
      <Skeleton className="h-3 w-24 mb-3 rounded" />

      {/* Value (large number) */}
      <Skeleton className="h-8 w-16 mb-2 rounded" />

      {/* Sub text */}
      <Skeleton className="h-3 w-32 mb-3 rounded" />

      {/* Sparkline area */}
      <Skeleton className="h-12 w-full rounded mt-1" />

      {/* Progress bar at very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-2xl">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    </div>
  );
}

// ─── ContentCardSkeleton ───────────────────────────────────────────────────────
// 3 lines of text (varying width) + a row of action buttons.

export function ContentCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
      <Skeleton className="h-4 w-3/4 mb-2.5 rounded" />
      <Skeleton className="h-4 w-full mb-2.5 rounded" />
      <Skeleton className="h-4 w-2/3 mb-5 rounded" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ─── ImageCardSkeleton ─────────────────────────────────────────────────────────
// Square by default; accepts aspect ratio override.

export function ImageCardSkeleton({
  aspect = "square",
}: {
  aspect?: "square" | "portrait" | "landscape";
}) {
  const aspectClass =
    aspect === "portrait"
      ? "aspect-[4/5]"
      : aspect === "landscape"
        ? "aspect-video"
        : "aspect-square";

  return <div className={cn("skeleton-shimmer rounded-2xl", aspectClass)} />;
}

// ─── CalendarDaySkeleton ───────────────────────────────────────────────────────
// Small day cell — day number + content preview area + badge.

export function CalendarDaySkeleton() {
  return (
    <div className="rounded-xl bg-white border border-gray-100 p-2 min-h-[80px] flex flex-col gap-1.5">
      {/* Day number */}
      <Skeleton className="h-3 w-5 rounded" />
      {/* Content preview area */}
      <Skeleton className="flex-1 w-full rounded-lg" style={{ minHeight: 36 }} />
      {/* Badge */}
      <Skeleton className="h-3 w-12 rounded-full" />
    </div>
  );
}

// ─── SidebarSkeleton ──────────────────────────────────────────────────────────
// Logo area + 5 nav item rows (icon + text label).

export function SidebarSkeleton() {
  return (
    <div className="w-[240px] h-screen bg-[#F8FAFC] border-r border-gray-100 p-4 flex flex-col shrink-0">
      {/* Logo */}
      <Skeleton className="h-6 w-32 mb-8 rounded" />

      {/* Nav items */}
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <Skeleton className="w-5 h-5 rounded-lg shrink-0" />
            <Skeleton className="h-4 flex-1 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GenerationResultSkeleton ─────────────────────────────────────────────────
// Full content pack shape:
//   3 caption cards (grid) + 1 ad copy card + 2 reel idea cards + 2 image cards.

export function GenerationResultSkeleton() {
  return (
    <div className="space-y-10">
      {/* Captions section */}
      <div>
        <Skeleton className="h-5 w-44 mb-4 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <ContentCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Ad copy section */}
      <div>
        <Skeleton className="h-5 w-28 mb-4 rounded" />
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
          <Skeleton className="h-6 w-2/3 mb-3 rounded" />
          <Skeleton className="h-4 w-full mb-2 rounded" />
          <Skeleton className="h-4 w-full mb-2 rounded" />
          <Skeleton className="h-4 w-3/4 mb-5 rounded" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Reel ideas section */}
      <div>
        <Skeleton className="h-5 w-36 mb-4 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <ContentCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* AI images section */}
      <div>
        <Skeleton className="h-5 w-44 mb-4 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <ImageCardSkeleton key={i} aspect="square" />
          ))}
        </div>
      </div>
    </div>
  );
}
