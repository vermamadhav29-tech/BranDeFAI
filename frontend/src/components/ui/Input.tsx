"use client";

import { useState, useId, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

// cubic-bezier(0.4, 0, 0.2, 1) — Material Design standard easing
const CSS_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const FM_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

// ─── Types ──────────────────────────────────────────────────────────────────────

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

interface CommonProps {
  label?: string;
  error?: string;
  success?: boolean;
  wrapperClassName?: string;
  leftIcon?: IconComponent;
}

export interface InputProps extends CommonProps, InputHTMLAttributes<HTMLInputElement> {}
export interface TextareaProps
  extends CommonProps,
    TextareaHTMLAttributes<HTMLTextAreaElement> {}

// ─── Style helpers ───────────────────────────────────────────────────────────────

function fieldStyle(
  focused: boolean,
  hasError: boolean,
  isSuccess: boolean
): React.CSSProperties {
  const actionColor = hasError ? "#DC2626" : "#1A7A4A";
  const showGreen = focused || isSuccess;
  return {
    borderColor: hasError ? "#DC2626" : showGreen ? "#1A7A4A" : "#E5E7EB",
    boxShadow: focused
      ? `0 0 0 3px ${hasError ? "#DC262620" : "#1A7A4A20"}`
      : "none",
    transition: `border-color 0.2s ${CSS_EASE}, box-shadow 0.2s ${CSS_EASE}`,
  };
}

function floatLabelStyle(lifted: boolean, hasError: boolean): React.CSSProperties {
  return {
    position: "absolute",
    left: 16,
    // Start at the same vertical position as the placeholder text (pt-[22px])
    top: 15,
    pointerEvents: "none",
    userSelect: "none",
    transformOrigin: "left center",
    // Lift 9px up + scale to 0.75 → effective: top ≈ 6px, font ≈ 12px
    transform: lifted ? "translateY(-9px) scale(0.75)" : "none",
    color: lifted ? (hasError ? "#DC2626" : "#1A7A4A") : "#9CA3AF",
    fontSize: "1rem",
    lineHeight: "1.5rem",
    whiteSpace: "nowrap",
    transition: `transform 0.2s ${CSS_EASE}, color 0.2s ${CSS_EASE}`,
  };
}

// ─── Animated error message ──────────────────────────────────────────────────────

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={msg}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: FM_EASE }}
        className="mt-1.5 text-sm text-red-600"
      >
        {msg}
      </motion.p>
    </AnimatePresence>
  );
}

// ─── Input ───────────────────────────────────────────────────────────────────────

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    success,
    wrapperClassName,
    leftIcon: LeftIcon,
    className,
    id: externalId,
    type,
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const autoId = useId();
  const id = externalId ?? autoId;

  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(() => {
    const v = value ?? defaultValue;
    return typeof v === "string" ? v.length > 0 : v != null;
  });
  const [showPass, setShowPass] = useState(false);

  // Keep hasValue in sync when the controlled value changes externally
  useEffect(() => {
    if (value !== undefined) setHasValue(String(value).length > 0);
  }, [value]);

  const isPassword = type === "password";
  const isLifted = focused || hasValue;
  const hasError = !!error;
  const hasRightIcon = isPassword || (!!success && !isPassword);

  return (
    <div className={cn("flex flex-col", wrapperClassName)}>
      <div className="relative">
        {LeftIcon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
            <LeftIcon size={16} />
          </span>
        )}
        <input
          {...rest}
          id={id}
          ref={ref}
          type={isPassword ? (showPass ? "text" : "password") : type}
          value={value}
          defaultValue={defaultValue}
          placeholder=" "
          onChange={(e) => {
            setHasValue(e.target.value.length > 0);
            onChange?.(e);
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            setHasValue(e.target.value.length > 0);
            onBlur?.(e);
          }}
          className={cn(
            "w-full h-14 rounded-xl border-[1.5px] outline-none bg-white",
            "px-4 pt-[22px] pb-2 text-sm text-[#1A2E44] placeholder-transparent",
            LeftIcon && "pl-10",
            hasRightIcon && "pr-11",
            className
          )}
          style={fieldStyle(focused, hasError, !!success)}
        />

        {label && (
          <label
            htmlFor={id}
            style={{
              ...floatLabelStyle(isLifted, hasError),
              left: LeftIcon ? 40 : 16,
            }}
          >
            {label}
          </label>
        )}

        {/* Success checkmark */}
        <AnimatePresence>
          {success && !isPassword && (
            <motion.span
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: FM_EASE }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1A7A4A] pointer-events-none"
            >
              <Check size={18} strokeWidth={2.5} />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Password eye toggle */}
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPass((s) => !s)}
            aria-label={showPass ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1A2E44] transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={showPass ? "off" : "on"}
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.18, ease: FM_EASE }}
                style={{ display: "inline-flex" }}
              >
                {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </div>

      {error && <ErrorMsg msg={error} />}
    </div>
  );
});

Input.displayName = "Input";

// ─── Textarea ────────────────────────────────────────────────────────────────────

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    error,
    success,
    wrapperClassName,
    className,
    id: externalId,
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,
    maxLength,
    ...rest
  },
  ref
) {
  const autoId = useId();
  const id = externalId ?? autoId;

  const [focused, setFocused] = useState(false);
  const [charCount, setCharCount] = useState(() => {
    const v = value ?? defaultValue;
    return typeof v === "string" ? v.length : 0;
  });

  useEffect(() => {
    if (value !== undefined) setCharCount(String(value).length);
  }, [value]);

  const hasValue = charCount > 0;
  const isLifted = focused || hasValue;
  const hasError = !!error;
  const showCounter = maxLength != null;

  const counterColor =
    !showCounter
      ? "#9CA3AF"
      : charCount / maxLength! >= 0.95
      ? "#DC2626"
      : charCount / maxLength! >= 0.8
      ? "#F59E0B"
      : "#9CA3AF";

  return (
    <div className={cn("flex flex-col", wrapperClassName)}>
      <div className="relative">
        <textarea
          {...rest}
          id={id}
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          placeholder=" "
          onChange={(e) => {
            setCharCount(e.target.value.length);
            onChange?.(e);
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            setCharCount(e.target.value.length);
            onBlur?.(e);
          }}
          className={cn(
            "w-full min-h-[7rem] rounded-xl border-[1.5px] outline-none bg-white resize-none",
            "px-4 pt-[22px] text-sm text-[#1A2E44] placeholder-transparent leading-relaxed",
            showCounter ? "pb-8" : "pb-3",
            className
          )}
          style={{ ...fieldStyle(focused, hasError, !!success), minHeight: "7rem" }}
        />

        {label && (
          <label htmlFor={id} style={floatLabelStyle(isLifted, hasError)}>
            {label}
          </label>
        )}

        {/* Character counter */}
        {showCounter && (
          <span
            className="absolute bottom-2.5 right-3.5 text-xs pointer-events-none select-none"
            style={{
              color: counterColor,
              transition: `color 0.2s ${CSS_EASE}`,
            }}
          >
            {charCount}/{maxLength}
          </span>
        )}
      </div>

      {error && <ErrorMsg msg={error} />}
    </div>
  );
});

Textarea.displayName = "Textarea";

export default Input;
