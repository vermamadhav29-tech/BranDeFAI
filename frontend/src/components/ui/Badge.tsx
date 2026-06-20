import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BadgeVariant =
  | "gray"
  | "green"
  | "blue"
  | "orange"
  | "red"
  | "purple"
  | "default"   // alias for gray
  | "success"   // alias for green
  | "warning"   // alias for orange
  | "danger";   // alias for red

export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  gray:    "bg-gray-100  text-gray-700",
  default: "bg-gray-100  text-gray-700",
  green:   "bg-[#E8F5EE] text-[#1A7A4A]",
  success: "bg-[#E8F5EE] text-[#1A7A4A]",
  blue:    "bg-blue-50   text-blue-700",
  orange:  "bg-amber-50  text-amber-700",
  warning: "bg-amber-50  text-amber-700",
  red:     "bg-red-50    text-red-700",
  danger:  "bg-red-50    text-red-700",
  purple:  "bg-purple-50 text-purple-700",
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
};

// ─── Badge ────────────────────────────────────────────────────────────────────

export default function Badge({
  variant = "gray",
  size = "md",
  className,
  style,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className
      )}
      style={style}
    >
      {children}
    </span>
  );
}
