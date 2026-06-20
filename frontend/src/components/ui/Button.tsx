"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────────

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// Extend framer-motion's own button type so event handlers never conflict.
// Override children to ReactNode (HTMLMotionProps includes MotionValue types).
export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gradient";
  size?: "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
  isDisabled?: boolean;
  showSuccess?: boolean;
  leftIcon?: IconComponent;
  rightIcon?: IconComponent;
}

// ─── Style maps ─────────────────────────────────────────────────────────────────

const SIZE_CLASS: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-10 px-5 text-sm rounded-xl",
  lg: "h-12 px-7 text-base rounded-xl",
  xl: "h-14 px-9 text-lg rounded-2xl",
};

const ICON_SIZE: Record<NonNullable<ButtonProps["size"]>, number> = {
  sm: 13,
  md: 15,
  lg: 17,
  xl: 19,
};

const VARIANT_TEXT: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "text-white font-semibold",
  secondary: "border-[1.5px] border-[#1A7A4A] text-[#1A7A4A] font-semibold",
  ghost: "text-[#1A2E44] font-medium",
  danger: "text-white font-semibold",
  gradient: "text-white font-semibold",
};

// ─── Dynamic inline styles (hover-driven) ──────────────────────────────────────

function variantStyle(
  variant: NonNullable<ButtonProps["variant"]>,
  hovered: boolean
): React.CSSProperties {
  switch (variant) {
    case "primary":
      return hovered
        ? {
            background: "linear-gradient(to right, #1A7A4A, #22C55E)",
            boxShadow: "0 0 0 4px #1A7A4A33",
            transition: "background 0.2s ease, box-shadow 0.15s ease",
          }
        : {
            background: "#1A7A4A",
            transition: "background 0.2s ease, box-shadow 0.15s ease",
          };

    case "secondary":
      return {
        background: hovered ? "#E8F5EE" : "#FFFFFF",
        transition: "background 0.15s ease",
      };

    case "ghost":
      return {
        background: hovered ? "#F5F7F9" : "transparent",
        transition: "background 0.15s ease",
      };

    case "danger":
      return {
        background: hovered ? "#B91C1C" : "#DC2626",
        transition: "background 0.15s ease",
      };

    case "gradient":
      return {
        background: "linear-gradient(to right, #1A7A4A, #059669, #34D399)",
        backgroundSize: "200% 100%",
        backgroundPosition: hovered ? "100% center" : "0% center",
        transition: "background-position 0.4s ease",
      };
  }
}

// ─── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ light }: { light: boolean }) {
  return (
    <span
      className={cn(
        "w-4 h-4 rounded-full border-2 animate-spin",
        light
          ? "border-white/30 border-t-white"
          : "border-gray-300 border-t-gray-600"
      )}
    />
  );
}

// ─── Button ────────────────────────────────────────────────────────────────────

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  isDisabled = false,
  showSuccess = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className,
  children,
  disabled: nativeDisabled,
  type,
  style: externalStyle,
  ...rest
}: ButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isEffectivelyDisabled =
    isDisabled || nativeDisabled || isLoading || isSuccess;
  const canInteract = !isEffectivelyDisabled;

  // Drive success flash from showSuccess prop
  useEffect(() => {
    if (!showSuccess) return;
    setIsSuccess(true);
    const t = setTimeout(() => setIsSuccess(false), 1500);
    return () => clearTimeout(t);
  }, [showSuccess]);

  // Drop hover state whenever button becomes non-interactive
  useEffect(() => {
    if (!canInteract) setIsHovered(false);
  }, [canInteract]);

  const iconSz = ICON_SIZE[size];
  const lightSpinner = ["primary", "danger", "gradient"].includes(variant);

  // Variant propagation: parent "hover"/"tap" cascades to icon children
  const buttonVariants = {
    rest: {},
    hover: variant === "primary" ? { y: -1 } : {},
    tap: { scale: 0.97 },
  };

  const iconVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.1 },
    tap: { scale: 1 },
  };

  return (
    <motion.button
      {...rest}
      type={type ?? "button"}
      disabled={isEffectivelyDisabled}
      variants={buttonVariants}
      initial="rest"
      animate="rest"
      whileHover={canInteract ? "hover" : undefined}
      whileTap={canInteract ? "tap" : undefined}
      transition={{ duration: 0.15 }}
      onHoverStart={() => canInteract && setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        ...variantStyle(variant, isHovered && canInteract),
        ...externalStyle,
      }}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden select-none",
        SIZE_CLASS[size],
        VARIANT_TEXT[variant],
        isEffectivelyDisabled && !isSuccess && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* ── Spinner (loading state) ─────────────────────────────────────── */}
      <AnimatePresence>
        {isLoading && (
          <motion.span
            key="spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Spinner light={lightSpinner} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* ── Success overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSuccess && (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center bg-green-500"
            style={{ borderRadius: "inherit" }}
          >
            <Check size={iconSz + 2} className="text-white" />
          </motion.span>
        )}
      </AnimatePresence>

      {/* ── Content (fades out when loading or success) ─────────────────── */}
      <span
        className={cn(
          "flex items-center gap-[inherit] pointer-events-none transition-opacity duration-100",
          (isLoading || isSuccess) ? "opacity-0" : "opacity-100"
        )}
      >
        {LeftIcon && (
          <motion.span
            variants={iconVariants}
            transition={{ duration: 0.15 }}
            className="flex items-center shrink-0"
          >
            <LeftIcon size={iconSz} />
          </motion.span>
        )}
        {children !== undefined && children !== null && (
          <span>{children}</span>
        )}
        {RightIcon && (
          <motion.span
            variants={iconVariants}
            transition={{ duration: 0.15 }}
            className="flex items-center shrink-0"
          >
            <RightIcon size={iconSz} />
          </motion.span>
        )}
      </span>
    </motion.button>
  );
}
