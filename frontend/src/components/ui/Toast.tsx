"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast as sonnerToast } from "sonner";

// ─── useToast hook ────────────────────────────────────────────────────────────
// Re-exports the global sonner-backed toast API.

export function useToast() {
  const success = useCallback((msg: string, description?: string) => {
    sonnerToast.success(msg, { description });
  }, []);

  const error = useCallback((msg: string, description?: string) => {
    sonnerToast.error(msg, { description });
  }, []);

  const info = useCallback((msg: string) => {
    sonnerToast.info(msg);
  }, []);

  const warning = useCallback((msg: string) => {
    sonnerToast.warning(msg);
  }, []);

  const dismiss = useCallback((id?: string | number) => {
    sonnerToast.dismiss(id);
  }, []);

  return { success, error, info, warning, dismiss };
}

// ─── Inline Toast (standalone, no sonner) ────────────────────────────────────
// Use this for simple in-page message banners that live in the DOM.

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: "bg-[#1A2E44]",
    iconColor: "text-[#34D399]",
  },
  error: {
    icon: XCircle,
    bg: "bg-[#1A2E44]",
    iconColor: "text-red-400",
  },
  info: {
    icon: Info,
    bg: "bg-[#1A2E44]",
    iconColor: "text-blue-400",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-[#1A2E44]",
    iconColor: "text-amber-400",
  },
} as const;

export type ToastType = keyof typeof TYPE_CONFIG;

export interface ToastProps {
  message: string;
  visible: boolean;
  type?: ToastType;
  onDismiss?: () => void;
  className?: string;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function Toast({
  message,
  visible,
  type = "success",
  onDismiss,
  className,
}: ToastProps) {
  const { icon: Icon, bg, iconColor } = TYPE_CONFIG[type];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className={cn(
            "fixed bottom-8 left-1/2 -translate-x-1/2 z-50",
            "flex items-center gap-2.5 text-white text-sm font-medium",
            "px-4 py-3 rounded-xl shadow-xl whitespace-nowrap",
            bg,
            className
          )}
        >
          <Icon size={16} className={iconColor} />
          <span>{message}</span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="ml-1 text-white/50 hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Toast;
