
interface ContentCardProps {
  title: string;
  type: string;
  status: "draft" | "scheduled" | "posted";
  scheduledAt?: string;
}

export default function ContentCard({ title, type, status, scheduledAt }: ContentCardProps) {
  return (
    <div>
      <div>
        <div>
          <p>{title}</p>
          <p>{type}</p>
        </div>
        <span>
          {status}
        </span>
      </div>
      {scheduledAt && (
        <p>{scheduledAt}</p>
      )}
    </div>
  );
}
