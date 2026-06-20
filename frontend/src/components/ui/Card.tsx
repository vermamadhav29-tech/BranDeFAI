"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Material easing + spring-like easing for mount
const HOVER_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
const MOUNT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Types ──────────────────────────────────────────────────────────────────────

type Variant = "default" | "highlighted" | "elevated" | "glass" | "gradient" | "stat";

export interface CardProps {
  variant?: Variant;
  /** Enables framer-motion whileHover: shadow increase + y: -2 */
  hoverable?: boolean;
  /** Fade + slide-up mount animation */
  animate?: boolean;
  className?: string;
  children?: React.ReactNode;
  // stat variant extras
  /** Accent color for top border and progress bar */
  accent?: string;
  /** Icon rendered in the 44px top-right container */
  icon?: React.ElementType;
  /** Tailwind bg class for the icon container */
  iconBg?: string;
  /** Tailwind text class for the icon */
  iconColor?: string;
  /** 0–1 progress fill for the bottom bar */
  progress?: number;
}

// ─── Variant style maps ──────────────────────────────────────────────────────────

const DEFAULT_SHADOW =
  "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)";
const HOVER_SHADOW = "0 10px 40px rgba(0,0,0,0.10)";

function variantStyle(v: Variant, accent?: string): React.CSSProperties {
  switch (v) {
    case "default":
      return {
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow: DEFAULT_SHADOW,
      };

    case "highlighted":
      return {
        background: "linear-gradient(to right, #E8F5EE, #FFFFFF)",
        border: "1px solid #E5E7EB",
        borderLeft: "3px solid #1A7A4A",
        boxShadow: DEFAULT_SHADOW,
      };

    case "elevated":
      return {
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow:
          "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
      };

    case "glass":
      return {
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
      };

    case "gradient":
      return {
        background: "linear-gradient(135deg, #1A7A4A, #065F46)",
        border: "none",
        boxShadow: "0 8px 32px rgba(26,122,74,0.3)",
      };

    case "stat":
      return {
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderTop: `3px solid ${accent ?? "#1A7A4A"}`,
        boxShadow: DEFAULT_SHADOW,
      };
  }
}

function hoverTarget(v: Variant): { y: number; boxShadow?: string } {
  // glass / gradient don't change shadow on hover (already vivid)
  if (v === "glass" || v === "gradient") return { y: -2 };
  return { y: -2, boxShadow: HOVER_SHADOW };
}

// ─── Card ────────────────────────────────────────────────────────────────────────

export function Card({
  variant = "default",
  hoverable = false,
  animate = false,
  className,
  children,
  accent,
  icon: Icon,
  iconBg,
  iconColor,
  progress,
}: CardProps) {
  const baseStyle = variantStyle(variant, accent);
  const isStat = variant === "stat";
  const isGradient = variant === "gradient";
  const hasIconSlot = isStat && !!Icon;
  const hasProgressBar = isStat && progress !== undefined;

  return (
    <motion.div
      // Mount animation — embedded transition overrides the hover transition below
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={
        animate
          ? {
              opacity: 1,
              y: 0,
              transition: { duration: 0.35, ease: MOUNT_EASE },
            }
          : undefined
      }
      // Hover — top-level transition applies to whileHover
      whileHover={hoverable ? hoverTarget(variant) : undefined}
      transition={{ duration: 0.25, ease: HOVER_EASE }}
      style={baseStyle}
      className={cn(
        "rounded-2xl p-6",
        (hasIconSlot || hasProgressBar) && "relative overflow-hidden",
        hoverable && "cursor-pointer",
        isGradient && "text-white",
        className
      )}
    >
      {/* Stat: 44px icon container pinned top-right */}
      {hasIconSlot && Icon && (
        <div
          className={cn(
            "absolute top-4 right-4 w-11 h-11 rounded-xl flex items-center justify-center",
            iconBg
          )}
        >
          <Icon size={18} className={iconColor} />
        </div>
      )}

      {children}

      {/* Stat: animated progress bar pinned to bottom edge */}
      {hasProgressBar && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 rounded-b-2xl overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((progress ?? 0) * 100, 100)}%` }}
            transition={{ duration: 0.8, ease: MOUNT_EASE }}
            style={{
              height: "100%",
              backgroundColor: accent ?? "#1A7A4A",
            }}
          />
        </div>
      )}
    </motion.div>
  );
}

// ─── Compound sub-components ─────────────────────────────────────────────────────

export function CardHeader({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <h3 className={cn("text-lg font-semibold text-[#1A2E44]", className)}>{children}</h3>;
}
