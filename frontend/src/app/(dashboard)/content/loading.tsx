import { GenerationResultSkeleton } from "@/components/ui/Skeleton";

export default function ContentLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="skeleton-shimmer h-7 w-52 rounded-xl" />
        <div className="skeleton-shimmer h-9 w-36 rounded-xl" />
      </div>

      {/* Full generation result skeleton */}
      <GenerationResultSkeleton />
    </div>
  );
}
