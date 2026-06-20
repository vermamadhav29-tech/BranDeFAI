"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EmptyVariant = "dashboard" | "calendar" | "images" | "videos" | "credits";

// Generic props — use when you don't need a preset variant
export interface EmptyStateGenericProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  actionButton?: React.ReactNode;
  className?: string;
}

// Preset variant props
interface EmptyStateVariantProps {
  variant: EmptyVariant;
  /** Called when the CTA button is clicked (overrides default href navigation). */
  onAction?: () => void;
  className?: string;
}

// ─── Animation constants ────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── SVG Illustrations ─────────────────────────────────────────────────────────

function RocketIllustration() {
  return (
    <svg width="110" height="130" viewBox="0 0 110 130" fill="none" aria-hidden>
      {/* Stars */}
      <circle cx="16" cy="22" r="2.5" fill="#E8F5EE" />
      <circle cx="94" cy="16" r="2" fill="#1A2E44" />
      <circle cx="88" cy="40" r="1.5" fill="#E8F5EE" />
      <circle cx="18" cy="50" r="1.5" fill="#1A2E44" opacity="0.5" />
      <circle cx="96" cy="62" r="2" fill="#E8F5EE" opacity="0.7" />

      {/* Rocket body */}
      <path
        d="M 55 10
           C 42 10 30 24 30 44
           L 30 86
           C 30 90 33 92 37 92
           L 73 92
           C 77 92 80 90 80 86
           L 80 44
           C 80 24 68 10 55 10 Z"
        fill="#1A7A4A"
      />

      {/* Body bottom accent stripe */}
      <rect x="30" y="74" width="50" height="7" fill="#065F46" opacity="0.35" />

      {/* Window outer ring */}
      <circle cx="55" cy="50" r="13" fill="white" opacity="0.95" />
      {/* Window inner */}
      <circle cx="55" cy="50" r="9" fill="#1A2E44" opacity="0.75" />
      {/* Window glare */}
      <circle cx="51" cy="46" r="3" fill="white" opacity="0.45" />

      {/* Left fin */}
      <path d="M 30 76 L 14 96 L 30 90 Z" fill="#065F46" />
      {/* Right fin */}
      <path d="M 80 76 L 96 96 L 80 90 Z" fill="#065F46" />

      {/* Flame: outer glow */}
      <ellipse cx="55" cy="104" rx="13" ry="16" fill="#F59E0B" opacity="0.85" />
      {/* Flame: mid */}
      <ellipse cx="55" cy="109" rx="8.5" ry="11" fill="#FCD34D" />
      {/* Flame: core */}
      <ellipse cx="55" cy="114" rx="5" ry="7" fill="#FEF9C3" />
    </svg>
  );
}

function CalendarIllustration() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden>
      {/* Calendar shadow */}
      <rect x="13" y="22" width="80" height="72" rx="10" fill="#E8F5EE" />

      {/* Calendar body */}
      <rect x="10" y="20" width="80" height="72" rx="10" fill="white" stroke="#E5E7EB" strokeWidth="2" />

      {/* Header bar */}
      <path d="M 10 20 Q 10 20 20 20 L 80 20 Q 90 20 90 30 L 90 44 L 10 44 L 10 30 Q 10 20 10 20 Z" fill="#1A7A4A" />
      <path d="M 10 38 L 90 38 L 90 44 L 10 44 Z" fill="#065F46" opacity="0.25" />

      {/* Ring posts */}
      <rect x="30" y="12" width="8" height="18" rx="4" fill="#1A2E44" />
      <rect x="62" y="12" width="8" height="18" rx="4" fill="#1A2E44" />

      {/* Header dot decorations */}
      <circle cx="34" cy="32" r="3" fill="white" opacity="0.4" />
      <circle cx="66" cy="32" r="3" fill="white" opacity="0.4" />

      {/* Date grid — row 1 */}
      <circle cx="24" cy="56" r="4" fill="#E5E7EB" />
      <circle cx="37" cy="56" r="4" fill="#E5E7EB" />
      <circle cx="50" cy="56" r="4.5" fill="#1A7A4A" />
      <circle cx="63" cy="56" r="4" fill="#E5E7EB" />
      <circle cx="76" cy="56" r="4" fill="#E5E7EB" />

      {/* Date grid — row 2 */}
      <circle cx="24" cy="70" r="4" fill="#E5E7EB" />
      <circle cx="37" cy="70" r="4" fill="#1A7A4A" opacity="0.45" />
      <circle cx="50" cy="70" r="4" fill="#E5E7EB" />
      <circle cx="63" cy="70" r="4" fill="#E5E7EB" />
      <circle cx="76" cy="70" r="4" fill="#E5E7EB" />

      {/* Date grid — row 3 */}
      <circle cx="24" cy="84" r="4" fill="#E5E7EB" />
      <circle cx="37" cy="84" r="4" fill="#E5E7EB" />
      <circle cx="50" cy="84" r="4" fill="#E5E7EB" />
      <circle cx="63" cy="84" r="4" fill="#1A7A4A" opacity="0.3" />

      {/* Sparkle 4-point star (top-right corner of header) */}
      <path
        d="M 80 28 L 82 22 L 84 28 L 90 26 L 84 30 L 82 36 L 80 30 L 74 26 Z"
        fill="#FCD34D"
      />
    </svg>
  );
}

function ImageIllustration() {
  return (
    <svg width="106" height="96" viewBox="0 0 106 96" fill="none" aria-hidden>
      {/* Frame shadow */}
      <rect x="9" y="9" width="74" height="80" rx="9" fill="#E8F5EE" />

      {/* Frame background */}
      <rect x="6" y="6" width="74" height="80" rx="9" fill="white" stroke="#E5E7EB" strokeWidth="2.5" />

      {/* Sky */}
      <rect x="8.5" y="8.5" width="69" height="78" rx="8" fill="#F0FDF4" />

      {/* Ground */}
      <path d="M 8.5 60 L 77.5 60 L 77.5 85 Q 77.5 86.5 76 86.5 L 10 86.5 Q 8.5 86.5 8.5 85 Z" fill="#DCFCE7" />

      {/* Background mountain */}
      <path d="M 14 60 L 36 28 L 58 60 Z" fill="#86EFAC" opacity="0.65" />

      {/* Foreground mountain */}
      <path d="M 26 60 L 50 30 L 78 60 Z" fill="#4ADE80" opacity="0.55" />

      {/* Sun */}
      <circle cx="66" cy="22" r="9" fill="#FEF08A" />
      <circle cx="66" cy="22" r="6" fill="#FDE047" />

      {/* Wand body */}
      <line x1="86" y1="8" x2="99" y2="21" stroke="#1A7A4A" strokeWidth="3.5" strokeLinecap="round" />

      {/* Wand star at tip */}
      <path
        d="M 86 8 L 87.5 3.5 L 89 8 L 93.5 6.5 L 89 9.5 L 87.5 14 L 86 9.5 L 81.5 6.5 Z"
        fill="#F59E0B"
      />

      {/* Wand sparkle dots */}
      <circle cx="96" cy="27" r="2.5" fill="#1A7A4A" />
      <circle cx="80" cy="16" r="2" fill="#1A7A4A" opacity="0.6" />
      <circle cx="100" cy="13" r="1.5" fill="#FCD34D" />
    </svg>
  );
}

function VideoIllustration() {
  return (
    <svg width="112" height="96" viewBox="0 0 112 96" fill="none" aria-hidden>
      {/* Board shadow */}
      <rect x="11" y="42" width="95" height="51" rx="9" fill="#E2E8F0" />

      {/* Main board body */}
      <rect x="8" y="40" width="95" height="51" rx="8" fill="#1A2E44" />

      {/* Film holes right edge */}
      <rect x="88" y="50" width="10" height="8" rx="2" fill="white" opacity="0.18" />
      <rect x="88" y="64" width="10" height="8" rx="2" fill="white" opacity="0.18" />
      <rect x="88" y="78" width="10" height="8" rx="2" fill="white" opacity="0.18" />

      {/* Content lines */}
      <rect x="16" y="54" width="58" height="4" rx="2" fill="white" opacity="0.18" />
      <rect x="16" y="65" width="42" height="4" rx="2" fill="white" opacity="0.12" />

      {/* Play button */}
      <circle cx="46" cy="74" r="13" fill="white" opacity="0.1" />
      <path d="M 41 68 L 41 80 L 55 74 Z" fill="white" opacity="0.75" />

      {/* Clapper top bar */}
      <rect x="8" y="14" width="95" height="23" rx="6" fill="#E5E7EB" />

      {/* Alternating green stripes on clapper */}
      <clipPath id="clipperBar">
        <rect x="8" y="14" width="95" height="23" rx="6" />
      </clipPath>
      <g clipPath="url(#clipperBar)">
        <rect x="8"  y="14" width="17" height="23" fill="#1A7A4A" />
        <rect x="30" y="14" width="17" height="23" fill="#1A7A4A" />
        <rect x="52" y="14" width="17" height="23" fill="#1A7A4A" />
        <rect x="74" y="14" width="17" height="23" fill="#1A7A4A" />
        <rect x="96" y="14" width="17" height="23" fill="#1A7A4A" />
      </g>

      {/* Hinge bar */}
      <rect x="5" y="37" width="101" height="7" rx="3.5" fill="#64748B" />

      {/* Hinge rivets */}
      <circle cx="26" cy="40.5" r="3" fill="#94A3B8" />
      <circle cx="56" cy="40.5" r="3" fill="#94A3B8" />
      <circle cx="86" cy="40.5" r="3" fill="#94A3B8" />
    </svg>
  );
}

function CreditsIllustration() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden>
      {/* Back coin */}
      <circle cx="38" cy="68" r="24" fill="#B45309" />
      <circle cx="38" cy="68" r="19" fill="#D97706" />
      <circle cx="38" cy="68" r="14" fill="#F59E0B" />
      <circle cx="38" cy="68" r="9"  fill="#FCD34D" opacity="0.7" />

      {/* Front coin */}
      <circle cx="60" cy="62" r="26" fill="#92400E" />
      <circle cx="60" cy="62" r="21" fill="#B45309" />
      <circle cx="60" cy="62" r="16" fill="#D97706" />
      <circle cx="60" cy="62" r="11" fill="#F59E0B" />
      <circle cx="60" cy="62" r="6"  fill="#FCD34D" opacity="0.65" />

      {/* Shine glare on front coin */}
      <circle cx="54" cy="55" r="4" fill="white" opacity="0.2" />

      {/* Lightning bolt */}
      <path
        d="M 56 10 L 42 34 L 53 32 L 45 55 L 64 25 L 52 27 Z"
        fill="#1A7A4A"
      />
      {/* Lightning bolt inner highlight */}
      <path
        d="M 54 14 L 45 32 L 53.5 32 L 49 46 L 60 27 L 51.5 27 Z"
        fill="#34D399"
        opacity="0.35"
      />

      {/* Sparkle dots */}
      <circle cx="78" cy="16" r="3"   fill="#FCD34D" />
      <circle cx="26" cy="28" r="2"   fill="#1A7A4A" />
      <circle cx="83" cy="38" r="2"   fill="#1A7A4A" opacity="0.5" />
      <circle cx="18" cy="50" r="1.5" fill="#FCD34D" opacity="0.6" />
    </svg>
  );
}

// ─── Per-variant config ─────────────────────────────────────────────────────────

interface VariantConfig {
  Illustration: () => React.ReactElement;
  heading: string;
  sub: string;
  cta?: {
    label: string;
    href?: string;
    /** If true, the `onAction` prop is called instead of navigating */
    usesAction?: boolean;
    primary?: boolean;
  };
}

const CONFIG: Record<EmptyVariant, VariantConfig> = {
  dashboard: {
    Illustration: RocketIllustration,
    heading: "Your brand is set up. Time to create.",
    sub: "Upload a product image below and generate your first content pack.",
    cta: {
      label: "Generate My First Content ✨",
      usesAction: true,
      primary: true,
    },
  },
  calendar: {
    Illustration: CalendarIllustration,
    heading: "Your calendar is empty",
    sub: "Generate content first, then it auto-fills your 30-day plan.",
    cta: {
      label: "Go Generate Content",
      href: "/dashboard",
    },
  },
  images: {
    Illustration: ImageIllustration,
    heading: "No images yet",
    sub: "Generate your first AI brand image using the prompt above.",
  },
  videos: {
    Illustration: VideoIllustration,
    heading: "No video projects yet",
    sub: "Create a new project and start building your first reel.",
    cta: {
      label: "Create New Project",
      usesAction: true,
    },
  },
  credits: {
    Illustration: CreditsIllustration,
    heading: "No transactions yet",
    sub: "Your credit usage will appear here once you start generating.",
  },
};

// ─── EmptyStateCustom (generic) ─────────────────────────────────────────────────

export function EmptyStateCustom({
  icon: Icon,
  title,
  description,
  actionButton,
  className,
}: EmptyStateGenericProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className={cn(
        "flex flex-col items-center justify-center py-14 px-6 text-center",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-[#1A2E44] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-5">{description}</p>
      )}
      {actionButton && <div className="mt-2">{actionButton}</div>}
    </motion.div>
  );
}

// ─── EmptyState (variant-based) ──────────────────────────────────────────────────

export function EmptyState({ variant, onAction, className }: EmptyStateVariantProps) {
  const { Illustration, heading, sub, cta } = CONFIG[variant];

  const hasCta = !!cta;
  const isPrimary = cta?.primary ?? false;

  const ctaClass = isPrimary
    ? "inline-flex items-center gap-2 bg-[#1A7A4A] hover:bg-[#145C38] text-white font-semibold rounded-xl px-8 py-3.5 text-sm transition-colors shadow-sm"
    : "inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-[#1A7A4A] hover:text-[#1A7A4A] text-[#1A2E44] font-medium rounded-xl px-6 py-2.5 text-sm transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      {/* Floating illustration */}
      <motion.div
        animate={{ y: [0, -9, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mb-6"
      >
        <Illustration />
      </motion.div>

      {/* Text */}
      <h2 className="text-xl font-bold text-[#1A2E44] max-w-xs">{heading}</h2>
      <p className="mt-2 text-sm text-gray-400 max-w-sm leading-relaxed">{sub}</p>

      {/* CTA */}
      {hasCta && (
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 0.4, delay: 1, ease: "easeInOut" }}
          className="mt-7"
        >
          {cta!.usesAction && onAction ? (
            <button type="button" onClick={onAction} className={ctaClass}>
              {cta!.label}
            </button>
          ) : cta!.href ? (
            <Link href={cta!.href} className={ctaClass}>
              {cta!.label}
            </Link>
          ) : null}
        </motion.div>
      )}
    </motion.div>
  );
}

export default EmptyState;
