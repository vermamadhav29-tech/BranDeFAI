export default function VideosLoading() {
  return (
    <div className="flex h-full -m-6">
      {/* Left panel — projects + media library */}
      <div className="w-72 shrink-0 border-r border-gray-100 bg-white p-4 space-y-3">
        <div className="skeleton-shimmer h-9 w-full rounded-xl" />
        <div className="skeleton-shimmer h-5 w-32 rounded mt-3" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-16 w-full rounded-xl" />
        ))}
        <div className="skeleton-shimmer h-9 w-full rounded-xl mt-2" />
      </div>

      {/* Center panel — timeline */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        <div className="skeleton-shimmer h-6 w-44 rounded" />
        <div className="skeleton-shimmer flex-1 w-full rounded-2xl" style={{ minHeight: 120 }} />
      </div>

      {/* Right panel — preview + controls */}
      <div className="w-80 shrink-0 border-l border-gray-100 bg-white p-4 space-y-4">
        <div className="skeleton-shimmer aspect-video w-full rounded-2xl" />
        <div className="skeleton-shimmer h-5 w-40 rounded" />
        <div className="skeleton-shimmer h-10 w-full rounded-xl" />
        <div className="skeleton-shimmer h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}
