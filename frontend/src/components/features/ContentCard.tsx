import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface ContentCardProps {
  title: string;
  type: string;
  status: "draft" | "scheduled" | "posted";
  scheduledAt?: string;
}

export default function ContentCard({ title, type, status, scheduledAt }: ContentCardProps) {
  return (
    <Card hoverable>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1A2E44] truncate">{title}</p>
          <p className="text-xs text-gray-500 mt-1">{type}</p>
        </div>
        <Badge variant={status === "posted" ? "success" : status === "scheduled" ? "warning" : "default"}>
          {status}
        </Badge>
      </div>
      {scheduledAt && (
        <p className="text-xs text-gray-400 mt-3">{scheduledAt}</p>
      )}
    </Card>
  );
}
