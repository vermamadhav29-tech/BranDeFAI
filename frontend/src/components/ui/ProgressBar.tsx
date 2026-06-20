"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgressBarProps {
  value: number;
  color?: "green" | "blue" | "red" | "amber" | "purple" | "custom";
  customColor?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  labelPosition?: "right" | "top";
  animated?: boolean;
  className?: string;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const HEIGHT: Record<NonNullable<ProgressBarProps["size"]>, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

const COLOR_MAP: Record<string, string> = {
  green:  "#1A7A4A",
  blue:   "#3B82F6",
  red:    "#EF4444",
  amber:  "#F59E0B",
  purple: "#8B5CF6",
};

// ─── ProgressBar ─────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  color = "green",
  customColor,
  size = "md",
  showLabel = false,
  labelPosition = "right",
  animated = true,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const fillColor = color === "custom" ? (customColor ?? "#1A7A4A") : (COLOR_MAP[color] ?? "#1A7A4A");

  const track = (
    <div className={cn("w-full bg-gray-100 rounded-full overflow-hidden", HEIGHT[size], className)}>
      <motion.div
        initial={animated ? { width: 0 } : false}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: "100%", backgroundColor: fillColor, borderRadius: "inherit" }}
      />
    </div>
  );

  if (!showLabel) return track;

  if (labelPosition === "top") {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">Progress</span>
          <span className="text-xs font-semibold text-gray-700">{clamped}%</span>
        </div>
        {track}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">{track}</div>
      <span
        className="text-xs font-semibold tabular-nums w-8 text-right"
        style={{ color: fillColor }}
      >
        {clamped}%
      </span>
    </div>
  );
}

export default ProgressBar;
