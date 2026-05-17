type ClassValue = string | undefined | null | false | Record<string, boolean>;

export function cn(...classes: ClassValue[]) {
  return classes
    .flatMap((c) => {
      if (!c) return [];
      if (typeof c === "object") return Object.entries(c).filter(([, v]) => v).map(([k]) => k);
      return [c];
    })
    .join(" ");
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
