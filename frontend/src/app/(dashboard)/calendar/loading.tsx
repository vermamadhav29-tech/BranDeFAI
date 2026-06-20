import { CalendarDaySkeleton } from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="skeleton-shimmer h-7 w-44 rounded-xl" />
          <div className="skeleton-shimmer h-4 w-56 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-shimmer h-9 w-28 rounded-xl" />
          <div className="skeleton-shimmer h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="skeleton-shimmer h-2 w-full rounded-full" />

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="skeleton-shimmer h-9 w-9 rounded-xl" />
        <div className="skeleton-shimmer h-6 w-36 rounded" />
        <div className="skeleton-shimmer h-9 w-9 rounded-xl" />
      </div>

      {/* 30-day grid — same 6-column layout as the real calendar */}
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 30 }).map((_, i) => (
          <CalendarDaySkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
