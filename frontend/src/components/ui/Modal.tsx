"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Rendered below the title; use for description or form fields */
  children: React.ReactNode;
  /** Rendered in a top-border footer row (e.g. action buttons) */
  footer?: React.ReactNode;
  /** Max width Tailwind class — default is max-w-lg */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Prevent closing on backdrop click */
  disableBackdropClose?: boolean;
}

const MAX_W: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className,
  disableBackdropClose = false,
}: ModalProps) {
  // Escape key handler
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={disableBackdropClose ? undefined : onClose}
          />

          {/* Card */}
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className={cn(
              "relative bg-white rounded-2xl shadow-2xl w-full",
              MAX_W[size],
              className
            )}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-6 pt-5 pb-0">
                <h2 className="text-lg font-semibold text-[#1A2E44]">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Close button (when no title) */}
            {!title && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors z-10"
              >
                <X size={16} />
              </button>
            )}

            {/* Content */}
            <div className={cn("px-6 py-5", title && "pt-4")}>{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
