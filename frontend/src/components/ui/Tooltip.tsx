"use client";

import { useState, useRef, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TooltipProps {
  content: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  children: React.ReactElement;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
}

// ─── Position styles ──────────────────────────────────────────────────────────

const POSITION_CLASSES: Record<NonNullable<TooltipProps["position"]>, string> = {
  top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left:   "right-full top-1/2 -translate-y-1/2 mr-2",
  right:  "left-full top-1/2 -translate-y-1/2 ml-2",
};

const INITIAL_MOTION: Record<NonNullable<TooltipProps["position"]>, { y?: number; x?: number }> = {
  top:    { y: 4 },
  bottom: { y: -4 },
  left:   { x: 4 },
  right:  { x: -4 },
};

// ─── Arrow ────────────────────────────────────────────────────────────────────

function Arrow({ position }: { position: NonNullable<TooltipProps["position"]> }) {
  const base = "absolute w-0 h-0 border-[5px] border-transparent";
  const styles: Record<string, string> = {
    top:    "top-full left-1/2 -translate-x-1/2 border-t-[#1A2E44]",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[#1A2E44]",
    left:   "left-full top-1/2 -translate-y-1/2 border-l-[#1A2E44]",
    right:  "right-full top-1/2 -translate-y-1/2 border-r-[#1A2E44]",
  };
  return <span className={cn(base, styles[position])} />;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

export function Tooltip({
  content,
  position = "top",
  delay = 300,
  children,
  className,
  contentClassName,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  function show() {
    if (disabled) return;
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }

  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const { y, x } = INITIAL_MOTION[position];

  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={visible ? id : undefined}
    >
      {children}

      <AnimatePresence>
        {visible && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: y ?? 0, x: x ?? 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: y ?? 0, x: x ?? 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "pointer-events-none absolute z-50 whitespace-nowrap",
              "rounded-lg bg-[#1A2E44] px-2.5 py-1.5",
              "text-xs font-medium text-white shadow-lg",
              POSITION_CLASSES[position],
              contentClassName
            )}
          >
            {content}
            <Arrow position={position} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export default Tooltip;
