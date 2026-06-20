"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import CountUp from "react-countup";
import {
  ArrowRight,
  Camera,
  Video,
  Brain,
  CalendarDays,
  FileText,
  Wand2,
  Check,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/hooks/useTheme";

const EASE_OUT: [number, number, number, number] = [0.25, 0.4, 0.25, 1];

const PARTICLES = [
  { id: 0,  x: 8,  y: 15, size: 2,   delay: 0,   dur: 6   },
  { id: 1,  x: 92, y: 8,  size: 1.5, delay: 0.8, dur: 8   },
  { id: 2,  x: 18, y: 72, size: 2.5, delay: 1.2, dur: 7   },
  { id: 3,  x: 78, y: 62, size: 1.5, delay: 0.4, dur: 9   },
  { id: 4,  x: 45, y: 88, size: 2,   delay: 2.1, dur: 6.5 },
  { id: 5,  x: 65, y: 22, size: 1,   delay: 1.7, dur: 7.5 },
  { id: 6,  x: 32, y: 40, size: 1.5, delay: 0.3, dur: 8.5 },
  { id: 7,  x: 88, y: 45, size: 2,   delay: 1.5, dur: 6   },
  { id: 8,  x: 12, y: 55, size: 1,   delay: 2.5, dur: 9.5 },
  { id: 9,  x: 55, y: 10, size: 2.5, delay: 0.9, dur: 7   },
  { id: 10, x: 72, y: 80, size: 1.5, delay: 1.1, dur: 8   },
  { id: 11, x: 25, y: 90, size: 1,   delay: 1.8, dur: 6.5 },
];

const NAV_LINKS = [
  { label: "Features",     href: "#features"     },
  { label: "How It Works", href: "#how-it-works"  },
  { label: "Pricing",      href: "#pricing"       },
  { label: "Blog",         href: "#"              },
];

const AVATAR_COLORS   = ["#1A7A4A", "#2563EB", "#7C3AED", "#D97706", "#0891B2"];
const AVATAR_INITIALS = ["R", "A", "P", "S", "M"];

const SIDEBAR_ITEMS = [
  { label: "Dashboard", active: false },
  { label: "Content",   active: true  },
  { label: "Calendar",  active: false },
  { label: "Images",    active: false },
  { label: "Videos",    active: false },
  { label: "Instagram", active: false },
];

const FEATURES = [
  {
    icon: Camera,
    color: "#A78BFA",
    bg: "rgba(167,139,250,0.15)",
    glow: "rgba(167,139,250,0.3)",
    title: "AI Product Photography",
    description: "Upload one product photo. Get studio-quality images with professional lighting, clean backgrounds, and lifestyle shots — without booking a single shoot.",
  },
  {
    icon: Video,
    color: "#60A5FA",
    bg: "rgba(96,165,250,0.15)",
    glow: "rgba(96,165,250,0.3)",
    title: "Cinematic Video Studio",
    description: "A real drag-and-drop timeline editor powered by RunwayML. Upload your product image, write a prompt, and get a cinematic brand video in under 60 seconds.",
  },
  {
    icon: Brain,
    color: "#34D399",
    bg: "rgba(52,211,153,0.15)",
    glow: "rgba(52,211,153,0.3)",
    title: "AI Brand Strategist",
    description: "BranDeFAI analyzes your brand, audience, and market trends to generate a full content strategy — hooks, directions, and a plan — before creating a single piece of content.",
  },
  {
    icon: CalendarDays,
    color: "#FBBF24",
    bg: "rgba(251,191,36,0.15)",
    glow: "rgba(251,191,36,0.3)",
    title: "30-Day Content Calendar",
    description: "Every caption, reel idea, ad copy, and image automatically assigned to a content calendar. Export as PDF or CSV. Your entire month planned in minutes.",
  },
  {
    icon: FileText,
    color: "#22D3EE",
    bg: "rgba(34,211,238,0.15)",
    glow: "rgba(34,211,238,0.3)",
    title: "AI Copywriter",
    description: "Get 3 scroll-stopping captions, 2 reel hooks with shot lists, and 1 high-converting ad copy — all written in your brand voice, every single time.",
  },
  {
    icon: Wand2,
    color: "#F472B6",
    bg: "rgba(244,114,182,0.15)",
    glow: "rgba(244,114,182,0.3)",
    title: "Image to Video Magic",
    description: "Upload any product photo and turn it into a luxury fashion video using AI. Cinematic slow motion, 360-degree views, editorial aesthetics — all from one still image.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Set Up Your Brand",
    description: "Tell BranDeFAI your brand name, industry, target audience, and tone. Takes 2 minutes. Done once.",
  },
  {
    step: "02",
    title: "Upload Your Product",
    description: "Drop in a product image. BranDeFAI reads your brand context and prepares to generate content tailored to your exact product.",
  },
  {
    step: "03",
    title: "Generate Your Content Pack",
    description: "Click generate. In under 60 seconds get captions, reel ideas, ad copy, and AI images — all in your brand voice.",
  },
  {
    step: "04",
    title: "Schedule and Publish",
    description: "Review your content calendar, make any edits, export your plan, and publish directly to Instagram. Your month is done.",
  },
];

const BRAND_BADGES = [
  "Anokhi Label",
  "Studio Meera",
  "Kapoor Textiles",
  "Rang Bazaar",
  "Zari Collective",
  "Craft & Co.",
];

const PLANS = [
  {
    name: "Free Trial",
    price: "₹0",
    period: "3 days",
    credits: "5 credits included",
    popular: false,
    features: [
      "5 AI image generations",
      "1 video generation",
      "Caption and ad copy generation",
      "Full platform access",
    ],
    cta: "Start Free Trial",
    ctaHref: "/login",
  },
  {
    name: "Growth",
    price: "₹1,799",
    period: "/month",
    credits: "100 credits/month",
    popular: true,
    features: [
      "100 AI image generations",
      "25 video reels",
      "Full content calendar",
      "Brand strategy AI",
      "Caption and ad copy generation",
      "Export PDF and CSV",
      "Priority support",
    ],
    cta: "Get Started",
    ctaHref: "/login",
  },
  {
    name: "Pro",
    price: "₹3,499",
    period: "/month",
    credits: "250 credits/month",
    popular: false,
    features: [
      "250 AI image generations",
      "60 video reels",
      "Everything in Growth",
      "Advanced video timeline editor",
      "Dedicated account manager",
      "API access (coming soon)",
      "White-label ready (coming soon)",
    ],
    cta: "Go Pro",
    ctaHref: "/login",
  },
];

const TESTIMONIALS = [
  {
    quote: "We used to spend ₹25,000 a month on a content agency. BranDeFAI replaced all of it for ₹1,799. The image quality genuinely shocked me the first time I saw it.",
    name: "Priya Sharma",
    brand: "Anokhi Label, Delhi",
  },
  {
    quote: "The video studio is what got me. I uploaded a photo of my lehenga and got a cinematic reel in under a minute. My Instagram reach doubled in the first week.",
    name: "Meera Joshi",
    brand: "Studio Meera, Mumbai",
  },
  {
    quote: "As a D2C founder doing everything myself, BranDeFAI is the only tool that actually understands brand strategy, not just content creation. It thinks before it creates.",
    name: "Arjun Kapoor",
    brand: "Kapoor Home Textiles, Jaipur",
  },
];

const FAQS = [
  {
    q: "Do I need design or marketing skills to use BranDeFAI?",
    a: "No. BranDeFAI is built for founders and brand owners, not designers. Once you set up your brand profile, the AI handles everything — strategy, copy, images, and videos.",
  },
  {
    q: "How is BranDeFAI different from tools like Canva or ChatGPT?",
    a: "Canva gives you templates. ChatGPT gives you text. BranDeFAI gives you a complete AI marketing system — brand strategy, AI images, cinematic videos, ad copy, and a 30-day calendar, all working together from your brand profile.",
  },
  {
    q: "What kind of brands is BranDeFAI built for?",
    a: "BranDeFAI is built specifically for fashion brands, jewellery labels, and D2C product brands in India. Every feature, prompt, and output is optimized for premium product content.",
  },
  {
    q: "How does video generation work?",
    a: "Upload a product image, describe the video you want, and BranDeFAI uses RunwayML — one of the world's best AI video models — to generate a cinematic brand video. You can arrange clips in the timeline editor and export the final video.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no lock-ins. Cancel from your account settings at any time. Your credits remain valid until the end of your billing period.",
  },
];

const PRODUCT_LINKS = ["Features", "Pricing", "How It Works", "Blog"];
const COMPANY_LINKS = ["About", "Careers", "Contact", "Privacy Policy", "Terms"];

const CONTENT_TABS = ["Captions", "Ad Copy", "Reel Ideas", "Images"] as const;
type ContentTab = typeof CONTENT_TABS[number];

const STATS = [
  { end: 500,   suffix: "+",     label: "Indian brands using BranDeFAI"  },
  { end: 50000, suffix: "+",     label: "pieces of content generated"     },
  { end: 30,    suffix: " days", label: "of content planned in minutes"   },
];

// ── AnimatedWords ──────────────────────────────────────────────────────────────
function AnimatedWords({ text, gradient = false, baseDelay = 0 }: { text: string; gradient?: boolean; baseDelay?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 0.55, delay: baseDelay + i * 0.1, ease: EASE_OUT }}
          className={`inline-block mr-[0.22em] ${gradient ? "bg-gradient-to-r from-[#1A7A4A] to-[#34D399] bg-clip-text text-transparent" : "text-[#111827]"}`}
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

// ── FAQItem ────────────────────────────────────────────────────────────────────
function FAQItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-5 text-left bg-white hover:bg-gray-50 transition-colors duration-200"
      >
        <span className="text-[#1A2E44] font-semibold text-base pr-4">{q}</span>
        <ChevronDown
          size={20}
          className="shrink-0 text-gray-400 transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {isOpen && (
        <div className="px-6 pb-5 bg-white border-t border-gray-100">
          <p className="text-gray-500 leading-relaxed pt-4">{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Content Preview Tab Components ─────────────────────────────────────────────
function CaptionPreview() {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm mx-auto" style={{ border: "1px solid #E5E7EB" }}>
      <div className="p-4 flex items-center gap-3 border-b border-gray-100">
        <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold" style={{ background: "linear-gradient(135deg, #1A7A4A, #34D399)" }}>A</div>
        <div>
          <p className="text-sm font-semibold text-gray-900">anokhi.label</p>
          <p className="text-xs text-gray-400">Just now · ✨ AI-Generated</p>
        </div>
      </div>
      <div className="h-48 flex items-center justify-center text-6xl select-none" style={{ background: "linear-gradient(135deg, #E8F5EE, #D1FAE5)" }}>👗</div>
      <div className="p-4 space-y-2">
        <p className="text-sm text-gray-700 leading-relaxed">
          <span className="font-semibold">anokhi.label</span>{" "}
          Elegance reimagined. Our new hand-block printed kurta collection is here — crafted for the woman who carries heritage in her stride. ✨
        </p>
        <p className="text-sm" style={{ color: "#1A7A4A" }}>#IndianFashion #BlockPrint #AnokiLabel</p>
        <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
          <span>❤️ 2,847 likes</span>
          <span>💬 142 comments</span>
        </div>
      </div>
    </div>
  );
}

function AdCopyPreview() {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm mx-auto" style={{ border: "1px solid #E5E7EB" }}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: "#E8F5EE", color: "#1A7A4A" }}>Facebook Ad</span>
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-50 text-blue-600">High CTR</span>
        </div>
        <h3 className="text-xl font-extrabold text-gray-900 leading-tight mb-3">
          Stop Paying ₹25,000/Month for a Content Agency.
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-5">
          BranDeFAI creates studio-quality images, captions, and reels for your brand in under 60 seconds. No photographers. No agencies. Just AI that understands your brand.
        </p>
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">brandefai.com</span>
          <span className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #1A7A4A, #145c38)" }}>
            Try Free →
          </span>
        </div>
      </div>
    </div>
  );
}

function ReelPreview() {
  const shots = [
    { n: "01", text: "Close-up of fabric texture — slow zoom in, warm light" },
    { n: "02", text: "Model enters frame wearing the kurta — editorial walk" },
    { n: "03", text: "Detail shots: embroidery, drape, hand block patterns" },
    { n: "04", text: "Final frame: product flat-lay with flowers and brand tag" },
  ];
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm mx-auto" style={{ border: "1px solid #E5E7EB" }}>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-[#1A7A4A]" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">AI Reel Script</span>
        </div>
        <p className="text-sm font-bold text-gray-900 mb-4 pb-4 border-b border-gray-100">
          Hook: &ldquo;You spent ₹40k on a shoot. We spent ₹0.&rdquo;
        </p>
        <div className="space-y-3">
          {shots.map((s) => (
            <div key={s.n} className="flex items-start gap-3">
              <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-md" style={{ background: "#E8F5EE", color: "#1A7A4A" }}>
                Scene {s.n}
              </span>
              <p className="text-xs text-gray-500 leading-relaxed pt-0.5">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImagePreview() {
  return (
    <div className="max-w-sm mx-auto">
      <div className="relative rounded-2xl overflow-hidden shadow-lg" style={{ border: "1px solid #E5E7EB" }}>
        <div className="h-60 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #E8F5EE 0%, #D1FAE5 50%, #A7F3D0 100%)" }}>
          <div className="text-center select-none">
            <div className="text-6xl mb-3">🪷</div>
            <div className="text-sm font-medium" style={{ color: "#1A7A4A" }}>Generating your image...</div>
          </div>
        </div>
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: "rgba(26,122,74,0.9)" }}>
            ✨ AI Generated
          </span>
        </div>
        <div className="absolute bottom-3 left-3 flex gap-2">
          <span className="px-2 py-0.5 rounded-md text-xs font-medium text-white" style={{ background: "rgba(0,0,0,0.55)" }}>1024×1024</span>
          <span className="px-2 py-0.5 rounded-md text-xs font-medium text-white" style={{ background: "rgba(0,0,0,0.55)" }}>DALL-E 3</span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">Studio-quality product photo · Generated in 15 seconds</p>
    </div>
  );
}

// ── App Window Preview ─────────────────────────────────────────────────────────
function AppWindowContent() {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center gap-3 px-5 py-3.5 bg-[#F9FAFB] border-b border-gray-200">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-white rounded-md px-5 py-1 text-[11px] text-gray-400 border border-gray-200 select-none">
            app.brandefai.com/dashboard
          </div>
        </div>
      </div>

      <div className="flex" style={{ height: 310 }}>
        <div className="w-[155px] shrink-0 bg-[#F8FAFC] border-r border-gray-100 p-4 flex flex-col">
          <div className="text-[#1A2E44] text-sm font-bold mb-4 select-none">
            Brande<span style={{ color: "#1A7A4A" }}>FAI</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {SIDEBAR_ITEMS.map(({ label, active }) => (
              <div
                key={label}
                className="text-[11.5px] px-2.5 py-1.5 rounded-lg select-none"
                style={{
                  background: active ? "#E8F5EE" : "transparent",
                  color: active ? "#1A7A4A" : "#9CA3AF",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-5 overflow-hidden bg-white">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 select-none">
            Generated Content
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl p-3 bg-white" style={{ border: "1px solid #D1FAE5" }}>
              <div className="w-7 h-0.5 bg-[#1A7A4A] rounded mb-2" />
              <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">
                ✨ Discover our newest collection and elevate your style today...
              </p>
              <div className="mt-2">
                <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#E8F5EE", color: "#1A7A4A" }}>Caption</span>
              </div>
            </div>

            <div className="rounded-xl p-3 bg-white" style={{ border: "1px solid #EDE9FE" }}>
              <div className="w-full rounded-lg mb-2 flex items-center justify-center text-xl" style={{ height: 62, background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(219,39,119,0.08))" }}>
                🖼️
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#F5F3FF", color: "#7C3AED" }}>Image</span>
            </div>

            <div className="rounded-xl p-3 bg-white" style={{ border: "1px solid #DBEAFE" }}>
              <div className="w-full rounded-lg mb-2 flex items-center justify-center gap-1.5" style={{ height: 50, background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(8,145,178,0.08))" }}>
                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-blue-500 ml-1" />
                <span className="text-[10px] text-blue-600 font-medium">Reel</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#EFF6FF", color: "#2563EB" }}>Reel Idea</span>
            </div>

            <div className="rounded-xl p-3 bg-white" style={{ border: "1px solid #FEF3C7" }}>
              <div className="w-7 h-0.5 bg-orange-400 rounded mb-2" />
              <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">
                🎯 Limited offer! Get 30% off today only. Don&apos;t miss out...
              </p>
              <div className="mt-2">
                <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#FFFBEB", color: "#D97706" }}>Ad Copy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [openFAQ, setOpenFAQ]   = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ContentTab>("Captions");
  const { isDark } = useTheme();

  const howItWorksRef = useRef<HTMLDivElement>(null);
  const howItWorksInView = useInView(howItWorksRef, { once: true, amount: 0.2 });

  const statsRef = useRef<HTMLElement>(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.3 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const line1 = "Your brand content,";
  const line2 = "automated completely.";
  const line1WordCount = line1.split(" ").length;
  const line2WordCount = line2.split(" ").length;

  const badgeDelay  = 0.1;
  const line1Delay  = 0.3;
  const line2Delay  = line1Delay + line1WordCount * 0.1 + 0.05;
  const subDelay    = line2Delay + line2WordCount * 0.1 + 0.15;
  const ctaDelay    = subDelay + 0.35;
  const socialDelay = ctaDelay + 0.2;
  const windowDelay = ctaDelay + 0.25;

  return (
    <>
      <style>{`
        @keyframes brandefai-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .badge-shimmer-inner {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%);
          background-size: 200% auto;
          animation: brandefai-shimmer 2.8s linear infinite;
        }
      `}</style>

      <main className="relative overflow-x-hidden bg-white">

        {/* Subtle green radial tint */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(26,122,74,0.06) 0%, transparent 70%)" }}
        />

        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: [
              "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {PARTICLES.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: "rgba(26,122,74,0.18)" }}
              animate={{ y: [0, -10, 0], x: [0, 4, 0] }}
              transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>

        {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
        <motion.nav
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
          style={{
            background: scrolled
              ? isDark ? "rgba(2,8,23,0.92)" : "rgba(255,255,255,0.92)"
              : "transparent",
            backdropFilter: scrolled ? "blur(14px)" : "none",
            WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
            borderBottom: scrolled
              ? isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)"
              : "none",
          }}
        >
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center select-none">
              <span className="text-[1.3rem] font-bold text-[#1A2E44] leading-none">
                BranDe<span className="text-[#1A7A4A]">FAI</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map(({ label, href }) => (
                <Link key={label} href={href} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors duration-200">
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-all duration-200 px-4 py-2 rounded-xl border border-gray-200 hover:border-gray-300 bg-white">
                Log In
              </Link>
              <Link
                href="/login"
                className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.97] transition-all duration-200"
                style={{ background: "linear-gradient(135deg, #1A7A4A, #145c38)" }}
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </motion.nav>

        {/* ── HERO ────────────────────────────────────────────────────────────── */}
        <section className="relative z-10 flex flex-col items-center text-center pt-[136px] pb-16 px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: badgeDelay, ease: EASE_OUT }}
            className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 overflow-hidden cursor-default select-none"
            style={{ background: "rgba(26,122,74,0.08)", border: "1px solid rgba(26,122,74,0.30)" }}
          >
            <span className="text-sm" aria-hidden>✨</span>
            <span className="text-sm font-semibold text-[#1A7A4A]">AI-Powered Marketing Platform</span>
            <div className="badge-shimmer-inner absolute inset-0 pointer-events-none rounded-full" />
          </motion.div>

          <h1
            className="font-extrabold leading-[1.07] tracking-tight mb-7 max-w-[860px]"
            style={{ fontSize: "clamp(2.8rem, 6vw, 4.5rem)" }}
          >
            <span className="block mb-1">
              <AnimatedWords text={line1} baseDelay={line1Delay} />
            </span>
            <span className="block">
              <AnimatedWords text={line2} gradient baseDelay={line2Delay} />
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: subDelay, ease: EASE_OUT }}
            className="text-gray-500 text-lg leading-relaxed max-w-[580px] mb-10"
          >
            Upload a product. Get captions, reels, ad copy, AI images, and a full 30-day calendar — auto-posted to Instagram.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: ctaDelay, ease: EASE_OUT }}
            className="flex flex-wrap items-center justify-center gap-4 mb-12"
          >
            <Link
              href="/login"
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-white font-semibold text-base transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #1A7A4A 0%, #145c38 100%)", boxShadow: "0 8px 32px rgba(26,122,74,0.25)" }}
            >
              Start Free — No Credit Card
              <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[#1A7A4A] font-semibold text-base border border-[#1A7A4A]/30 hover:border-[#1A7A4A] hover:bg-[#E8F5EE] transition-all duration-200"
            >
              See How It Works →
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, delay: socialDelay, ease: EASE_OUT }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {AVATAR_COLORS.map((color, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ backgroundColor: color, border: "2px solid #FFFFFF" }}
                  >
                    {AVATAR_INITIALS[i]}
                  </div>
                ))}
              </div>
              <span className="text-sm text-gray-500">
                <span className="text-gray-900 font-semibold">500+</span> Indian brands use BranDeFAI
              </span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="flex gap-px">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="text-yellow-400 text-base leading-none">★</span>
                ))}
              </div>
              <span className="text-sm text-gray-500">
                <span className="text-gray-900 font-semibold">4.9</span>/5
              </span>
            </div>
          </motion.div>
        </section>

        {/* ── APP WINDOW PREVIEW ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: windowDelay, ease: EASE_OUT }}
          className="relative z-10 px-6 pb-28 max-w-5xl mx-auto"
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
            style={{ transform: "rotate(-2deg)" }}
          >
            <AppWindowContent />
          </motion.div>
        </motion.div>

        {/* ── FEATURES — dark ──────────────────────────────────────────────────── */}
        <section id="features" className="py-24 px-6 relative overflow-hidden" style={{ background: "#030712" }}>
          {/* Green corner glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 55% 55% at 100% 0%, rgba(26,122,74,0.22) 0%, transparent 60%)" }}
          />

          <div className="max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                viewport={{ once: true, amount: 0.2 }}
                className="text-4xl font-extrabold text-white mb-4 leading-tight"
              >
                Everything your brand needs.{" "}
                <span className="bg-gradient-to-r from-[#1A7A4A] to-[#34D399] bg-clip-text text-transparent">
                  Nothing it doesn&apos;t.
                </span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
                viewport={{ once: true, amount: 0.2 }}
                className="text-gray-400 text-lg max-w-xl mx-auto"
              >
                One platform that replaces your photographer, copywriter, video editor, and content strategist.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: EASE_OUT }}
                    viewport={{ once: true, amount: 0.1 }}
                    whileHover={{
                      y: -5,
                      boxShadow: `0 0 0 1px ${feature.glow}, 0 12px 40px rgba(0,0,0,0.4)`,
                      background: "rgba(255,255,255,0.05)",
                      transition: { duration: 0.2 },
                    }}
                    className="rounded-2xl p-6 cursor-default group"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-110"
                      style={{ background: feature.bg }}
                    >
                      <Icon size={22} style={{ color: feature.color }} />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2.5">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS — redesigned ────────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                viewport={{ once: true }}
                className="text-4xl font-extrabold text-[#1A2E44] mb-4 leading-tight"
              >
                From zero to a month of content{" "}
                <span className="bg-gradient-to-r from-[#1A7A4A] to-[#34D399] bg-clip-text text-transparent">
                  in one afternoon.
                </span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
                viewport={{ once: true }}
                className="text-gray-500 text-lg max-w-xl mx-auto"
              >
                No agency. No photographer. No designer. Just your brand and BranDeFAI.
              </motion.p>
            </div>

            {/* Steps with animated dashed connector */}
            <div className="relative" ref={howItWorksRef}>
              {/* Dashed line — only on lg screens */}
              <div
                className="absolute hidden lg:block pointer-events-none"
                style={{ top: 31, left: "12.5%", right: "12.5%" }}
              >
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: howItWorksInView ? 1 : 0 }}
                  transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.35 }}
                  style={{
                    height: 2,
                    transformOrigin: "left center",
                    background: "repeating-linear-gradient(90deg, rgba(26,122,74,0.4) 0, rgba(26,122,74,0.4) 8px, transparent 8px, transparent 20px)",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
                {HOW_IT_WORKS.map((step, i) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.15, ease: EASE_OUT }}
                    viewport={{ once: true }}
                    className="flex flex-col items-center text-center"
                  >
                    {/* Step circle */}
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-6 relative z-10"
                      style={{
                        background: "white",
                        border: "2px solid rgba(26,122,74,0.25)",
                        boxShadow: "0 0 0 6px rgba(26,122,74,0.05)",
                      }}
                    >
                      <span
                        className="text-2xl font-extrabold leading-none"
                        style={{
                          background: "linear-gradient(135deg, #1A7A4A, #34D399)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        {step.step}
                      </span>
                    </div>
                    <h3 className="text-[#1A2E44] font-bold text-lg mb-2">{step.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CONTENT PREVIEW — new ────────────────────────────────────────────── */}
        <section className="py-24 px-6" style={{ background: "#F5F7F9" }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                viewport={{ once: true }}
                className="text-4xl font-extrabold text-[#1A2E44] mb-4 leading-tight"
              >
                See what BranDeFAI{" "}
                <span className="bg-gradient-to-r from-[#1A7A4A] to-[#34D399] bg-clip-text text-transparent">
                  creates in seconds
                </span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
                viewport={{ once: true }}
                className="text-gray-500 text-lg"
              >
                Real output. One brand. Zero agencies.
              </motion.p>
            </div>

            {/* Tab switcher */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: EASE_OUT }}
              viewport={{ once: true }}
              className="flex justify-center mb-10"
            >
              <div
                className="flex items-center gap-1 p-1.5 rounded-2xl"
                style={{ background: "rgba(0,0,0,0.06)" }}
              >
                {CONTENT_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                    style={{
                      color: activeTab === tab ? "#1A2E44" : "#6B7280",
                      background: activeTab === tab ? "white" : "transparent",
                      boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Tab content with AnimatePresence */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
              >
                {activeTab === "Captions"   && <CaptionPreview />}
                {activeTab === "Ad Copy"    && <AdCopyPreview />}
                {activeTab === "Reel Ideas" && <ReelPreview />}
                {activeTab === "Images"     && <ImagePreview />}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ── STATS — new ──────────────────────────────────────────────────────── */}
        <section
          className="py-24 px-6"
          style={{ background: "#030712" }}
          ref={statsRef}
        >
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.12, ease: EASE_OUT }}
                  viewport={{ once: true }}
                >
                  <div
                    className="text-5xl font-extrabold mb-3 leading-none tabular-nums"
                    style={{
                      background: "linear-gradient(135deg, #1A7A4A, #34D399)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {statsInView
                      ? <CountUp end={stat.end} duration={2.5} separator="," suffix={stat.suffix} />
                      : <span>0</span>
                    }
                  </div>
                  <p className="text-gray-400 text-base font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SOCIAL PROOF BANNER ──────────────────────────────────────────────── */}
        <section className="py-16 px-6" style={{ background: "#E8F5EE" }}>
          <div className="max-w-4xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              viewport={{ once: true }}
              className="text-[#1A2E44] font-bold text-xl mb-8"
            >
              Trusted by 500+ Indian fashion and D2C brands
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
              viewport={{ once: true }}
              className="flex flex-wrap justify-center gap-3"
            >
              {BRAND_BADGES.map((brand) => (
                <span
                  key={brand}
                  className="px-5 py-2 rounded-full bg-white border border-[#1A7A4A]/20 text-[#1A7A4A] font-medium text-sm shadow-sm"
                >
                  {brand}
                </span>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────────────────────── */}
        <section id="pricing" className="py-24 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                viewport={{ once: true }}
                className="text-4xl font-extrabold text-[#1A2E44] mb-4 leading-tight"
              >
                Simple pricing.{" "}
                <span className="bg-gradient-to-r from-[#1A7A4A] to-[#34D399] bg-clip-text text-transparent">
                  Powerful results.
                </span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
                viewport={{ once: true }}
                className="text-gray-500 text-lg"
              >
                Start free. Scale when you grow. Cancel anytime.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {PLANS.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.12, ease: EASE_OUT }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  className="rounded-2xl p-8 bg-white relative"
                  style={{
                    border: plan.popular ? "2px solid #1A7A4A" : "1px solid #E5E7EB",
                    boxShadow: plan.popular ? "0 8px 40px rgba(26,122,74,0.12)" : "none",
                  }}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span
                        className="px-4 py-1.5 rounded-full bg-[#1A7A4A] text-white text-xs font-bold tracking-wide whitespace-nowrap inline-block"
                        style={{ transform: "rotate(-2deg)" }}
                      >
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{plan.name}</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-extrabold text-[#1A2E44]">{plan.price}</span>
                    <span className="text-gray-400 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-xs text-[#1A7A4A] font-medium mb-7">{plan.credits}</p>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check size={15} className="text-[#1A7A4A] mt-0.5 shrink-0" />
                        <span className="text-sm text-gray-600">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.ctaHref}
                    className="block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                    style={
                      plan.popular
                        ? { background: "linear-gradient(135deg, #1A7A4A, #145c38)", color: "#fff" }
                        : { border: "1px solid #E5E7EB", color: "#374151", background: "white" }
                    }
                  >
                    {plan.cta}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */}
        <section className="py-24 px-6 bg-[#F9FAFB]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                viewport={{ once: true }}
                className="text-4xl font-extrabold text-[#1A2E44] leading-tight"
              >
                Brands that moved from agencies to{" "}
                <span className="bg-gradient-to-r from-[#1A7A4A] to-[#34D399] bg-clip-text text-transparent">
                  BranDeFAI
                </span>
              </motion.h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: EASE_OUT }}
                  viewport={{ once: true }}
                  className="rounded-2xl p-7 bg-white border border-gray-100 shadow-sm"
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <span key={j} className="text-yellow-400 text-lg leading-none">★</span>
                    ))}
                  </div>
                  <p className="text-gray-600 leading-relaxed mb-6 text-sm">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-semibold text-[#1A2E44] text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.brand}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-14">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                viewport={{ once: true }}
                className="text-4xl font-extrabold text-[#1A2E44]"
              >
                Everything you want to know.
              </motion.h2>
            </div>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <motion.div
                  key={faq.q}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.07, ease: EASE_OUT }}
                  viewport={{ once: true }}
                >
                  <FAQItem
                    q={faq.q}
                    a={faq.a}
                    isOpen={openFAQ === i}
                    onToggle={() => setOpenFAQ(openFAQ === i ? null : i)}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
        <section
          className="py-28 px-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1A7A4A 0%, #065F46 100%)" }}
        >
          {/* Noise texture overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              opacity: 0.035,
              mixBlendMode: "overlay",
            }}
          />

          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              viewport={{ once: true }}
              className="text-4xl font-extrabold text-white mb-4 leading-tight"
            >
              Your brand deserves better content.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
              viewport={{ once: true }}
              className="text-white/80 text-lg max-w-lg mx-auto mb-10"
            >
              Join 500+ Indian brands already using BranDeFAI to create, plan, and publish premium content with AI.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: EASE_OUT }}
              viewport={{ once: true }}
            >
              <motion.div
                whileHover={{ scale: 1.04, boxShadow: "0 16px 48px rgba(0,0,0,0.25)" }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="inline-block"
              >
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-white text-[#1A7A4A] font-bold text-base"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
                >
                  Start Free — No Credit Card Needed
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
        <footer className="py-16 px-6 bg-[#F8FAFC] border-t border-gray-100">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
              <div>
                <Link href="/" className="flex items-center mb-3 select-none">
                  <span className="text-xl font-bold text-[#1A2E44] leading-none">
                    BranDe<span className="text-[#1A7A4A]">FAI</span>
                  </span>
                </Link>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">
                  AI marketing for brands that refuse to look average.
                </p>
                <p className="text-xs text-gray-400">© 2026 BranDeFAI. All rights reserved.</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-[#1A2E44] mb-4">Product</h4>
                <ul className="space-y-3">
                  {PRODUCT_LINKS.map((link) => (
                    <li key={link}>
                      <Link href="#" className="text-sm text-gray-500 hover:text-[#1A7A4A] transition-colors duration-200">{link}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-[#1A2E44] mb-4">Company</h4>
                <ul className="space-y-3">
                  {COMPANY_LINKS.map((link) => (
                    <li key={link}>
                      <Link href="#" className="text-sm text-gray-500 hover:text-[#1A7A4A] transition-colors duration-200">{link}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-[#1A2E44] mb-4">Contact</h4>
                <a
                  href="mailto:support@brandefai.com"
                  className="text-sm text-gray-500 hover:text-[#1A7A4A] transition-colors duration-200 block mb-3"
                >
                  support@brandefai.com
                </a>
                <p className="text-sm text-gray-400">Built in India for Indian brands</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-400">Made with care for Indian D2C and fashion brands.</p>
              <div className="flex items-center gap-5">
                <Link href="#" className="text-xs text-gray-400 hover:text-[#1A7A4A] transition-colors duration-200">Privacy Policy</Link>
                <Link href="#" className="text-xs text-gray-400 hover:text-[#1A7A4A] transition-colors duration-200">Terms</Link>
              </div>
            </div>
          </div>
        </footer>

      </main>
    </>
  );
}
