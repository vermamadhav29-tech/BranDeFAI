import { ImageCardSkeleton } from "@/components/ui/Skeleton";

export default function ImagesLoading() {
  return (
    <div className="flex gap-6 max-w-7xl mx-auto">
      {/* Left panel — generation controls */}
      <div className="w-80 shrink-0 space-y-4">
        <div className="skeleton-shimmer h-7 w-40 rounded-xl" />
        <div className="skeleton-shimmer h-4 w-56 rounded-lg" />
        {/* Prompt textarea */}
        <div className="skeleton-shimmer h-28 w-full rounded-2xl" />
        {/* Option selectors */}
        <div className="skeleton-shimmer h-10 w-full rounded-xl" />
        <div className="skeleton-shimmer h-10 w-full rounded-xl" />
        <div className="skeleton-shimmer h-10 w-full rounded-xl" />
        {/* Generate button */}
        <div className="skeleton-shimmer h-12 w-full rounded-xl" />
      </div>

      {/* Right panel — image gallery */}
      <div className="flex-1 space-y-4">
        <div className="skeleton-shimmer h-7 w-32 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ImageCardSkeleton key={i} aspect="square" />
          ))}
        </div>
      </div>
    </div>
  );
}
