"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  Download,
  Loader2,
  Sparkles,
  ArrowRight,
  Image as ImageIcon,
  X,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { GenerationResultSkeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AdCopy {
  headline: string;
  body: string;
  cta: string;
}

interface ReelIdea {
  hook: string;
  shotList: string[];
}

interface ContentRecord {
  id: string;
  captions: string[];
  adCopy: AdCopy;
  reelIdeas: ReelIdea[];
  images: (string | null)[] | null;
  createdAt: string;
}

// ─── CopyButton ──────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      leftIcon={copied ? Check : Copy}
      onClick={handleCopy}
      className={cn(copied ? "text-[#1A7A4A] bg-[#E8F5EE]" : "text-gray-500 bg-gray-50 hover:bg-gray-100")}
    >
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

// ─── ImageCard ───────────────────────────────────────────────────────────────────

function SavedImageCard({ url, index }: { url: string | null; index: number }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!url) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `brandefai-image-${index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }

  if (!url) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <X size={18} className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-400">Image not available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Generated image ${index + 1}`}
        className="w-full aspect-square object-cover"
        loading="lazy"
      />
      <div className="p-3 border-t border-gray-50">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Download
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const [content, setContent] = useState<ContentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: ContentRecord | null }>("/api/content/latest")
      .then((res) => {
        if (res.data.success) {
          setContent(res.data.data);
        } else {
          setError("Could not load your content.");
        }
      })
      .catch(() => setError("Could not load your content."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <GenerationResultSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-[#1A7A4A] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-[#E8F5EE] flex items-center justify-center">
          <ImageIcon size={28} className="text-[#1A7A4A]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1A2E44]">No content generated yet</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            Upload a product image on the dashboard and generate your first content pack.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 bg-[#1A7A4A] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#145C38] transition-colors"
        >
          Go to Dashboard
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  const images = content.images ?? [null, null];
  const createdDate = new Date(content.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-[860px] mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-[#E8F5EE] flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-[#1A7A4A]" />
            </div>
            <h1 className="text-xl font-bold text-[#1A2E44]">Your Last Content Pack</h1>
          </div>
          <p className="text-xs text-gray-400 ml-10">Generated on {createdDate}</p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-semibold bg-[#1A7A4A] text-white px-4 py-2 rounded-xl hover:bg-[#145C38] transition-colors"
        >
          Generate New
          <ArrowRight size={14} />
        </Link>
      </motion.div>

      {/* Captions */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Instagram Captions
          <span className="normal-case font-normal ml-1 text-gray-300">— choose your favourite</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(content.captions as string[]).map((caption, i) => (
            <div
              key={i}
              className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col min-h-[130px]"
            >
              <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-3">{caption}</p>
              <div className="pt-2 border-t border-gray-50">
                <CopyButton text={caption} />
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Ad Copy */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ad Copy</p>
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <p className="text-xl font-bold text-[#1A2E44] mb-2 leading-snug">
            {(content.adCopy as AdCopy).headline}
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            {(content.adCopy as AdCopy).body}
          </p>
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-50">
            <span className="inline-block bg-[#E8F5EE] text-[#1A7A4A] text-xs font-bold px-3 py-1.5 rounded-full">
              {(content.adCopy as AdCopy).cta}
            </span>
            <CopyButton
              text={`${(content.adCopy as AdCopy).headline}\n\n${(content.adCopy as AdCopy).body}\n\n${(content.adCopy as AdCopy).cta}`}
            />
          </div>
        </div>
      </motion.section>

      {/* Reel Ideas */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Reel Ideas
          <span className="normal-case font-normal ml-1 text-gray-300">— shot-by-shot breakdown</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(content.reelIdeas as ReelIdea[]).map((idea, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <p className="text-[#1A7A4A] font-bold text-sm leading-snug mb-4 pl-3 border-l-2 border-[#1A7A4A]">
                &ldquo;{idea.hook}&rdquo;
              </p>
              <ol className="space-y-2">
                {idea.shotList.map((shot, j) => (
                  <li key={j} className="flex gap-2 text-sm text-gray-600">
                    <span className="shrink-0 text-base leading-tight">🎥</span>
                    <span className="leading-snug">
                      <span className="font-semibold text-gray-400 mr-1">{j + 1}.</span>
                      {shot}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Images */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          AI-Generated Visuals
        </p>
        <div className="grid grid-cols-2 gap-4">
          {images.map((url, i) => (
            <SavedImageCard key={i} url={url} index={i} />
          ))}
        </div>
      </motion.section>
    </div>
  );
}
