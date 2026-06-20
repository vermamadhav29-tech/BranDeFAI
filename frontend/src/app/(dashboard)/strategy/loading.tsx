export default function StrategyLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">
      {/* Page header */}
      <div className="space-y-2">
        <div className="skeleton-shimmer h-8 w-52 rounded-xl" />
        <div className="skeleton-shimmer h-4 w-64 rounded-lg" />
      </div>

      {/* Content Pillars — 2-column grid */}
      <div className="space-y-3">
        <div className="skeleton-shimmer h-5 w-36 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer rounded-2xl h-36" />
          ))}
        </div>
      </div>

      {/* Hook Frameworks — list */}
      <div className="space-y-3">
        <div className="skeleton-shimmer h-5 w-44 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer rounded-xl h-16" />
        ))}
      </div>

      {/* Posting Rhythm + Content Mix — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="skeleton-shimmer rounded-2xl h-36" />
        <div className="skeleton-shimmer rounded-2xl h-36" />
      </div>

      {/* Month Direction summary */}
      <div className="skeleton-shimmer rounded-2xl h-24" />
    </div>
  );
}
