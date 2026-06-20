import { StatCardSkeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Greeting heading */}
      <div className="space-y-1.5">
        <div className="skeleton-shimmer h-8 w-52 rounded-xl" />
        <div className="skeleton-shimmer h-4 w-40 rounded-lg" />
      </div>

      {/* Stats grid — 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Generate CTA banner */}
      <div className="skeleton-shimmer rounded-2xl h-48 w-full" />

      {/* Recent Generations */}
      <div className="space-y-3">
        <div className="skeleton-shimmer h-5 w-44 rounded" />
        <div className="skeleton-shimmer rounded-xl h-32 w-full" />
      </div>

      {/* Quick Links */}
      <div className="space-y-3">
        <div className="skeleton-shimmer h-5 w-28 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="skeleton-shimmer rounded-xl h-20" />
          <div className="skeleton-shimmer rounded-xl h-20" />
          <div className="skeleton-shimmer rounded-xl h-20" />
        </div>
      </div>
    </div>
  );
}
