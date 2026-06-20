import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Logo section skeleton */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <Skeleton className="h-5 w-28 mb-1" />
        <Skeleton className="h-3 w-64 mb-5" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>

      {/* Brand info skeleton */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-28 shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
