export default function InstagramLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-2">
      {/* Header */}
      <div className="space-y-2">
        <div className="skeleton-shimmer h-8 w-48 rounded-xl" />
        <div className="skeleton-shimmer h-4 w-64 rounded-lg" />
      </div>

      {/* Post grid preview */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}
