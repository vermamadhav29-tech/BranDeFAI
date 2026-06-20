"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Check, Loader2, Trash2, ImageIcon, RefreshCw, Mic } from "lucide-react";
import apiClient from "@/lib/apiClient";
import { useBrandStore } from "@/stores/brandStore";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import Button from "@/components/ui/Button";
import type { Brand } from "@/types";

// ─── LogoSection ──────────────────────────────────────────────────────────────

function LogoSection({
  brand,
  onLogoChange,
}: {
  brand: Brand;
  onLogoChange: (logoUrl: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    const allowed = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only PNG, SVG, JPEG, and WebP are accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Logo must be 2 MB or smaller.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const uploadRes = await apiClient.post<{
        success: boolean;
        data: { logoUrl: string };
        error: string | null;
      }>("/api/uploads/brand-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!uploadRes.data.success || !uploadRes.data.data) {
        setUploadError(uploadRes.data.error ?? "Upload failed.");
        return;
      }

      const newLogoUrl = uploadRes.data.data.logoUrl;
      await apiClient.patch("/api/brand/logo", { logoUrl: newLogoUrl });
      onLogoChange(newLogoUrl);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setUploadError(e.response?.data?.error ?? e.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [onLogoChange]);

  async function handleRemove() {
    setRemoving(true);
    try {
      await apiClient.patch("/api/brand/logo", { logoUrl: null });
      onLogoChange(null);
      setConfirmRemove(false);
    } catch {
      // silently fail — toast shown by parent
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="mb-5">
        <h2 className="text-base font-bold text-[#1A2E44]">Brand Logo</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          PNG or SVG with transparent background recommended · Max 2 MB
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />

      {brand.logoUrl ? (
        <div className="space-y-4">
          {/* Preview on light + dark */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white border-2 border-gray-100 flex items-center justify-center p-5 h-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.logoUrl}
                alt="Logo on light background"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="rounded-xl bg-[#1A2E44] flex items-center justify-center p-5 h-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.logoUrl}
                alt="Logo on dark background"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="primary"
              isLoading={uploading}
              leftIcon={Upload}
              onClick={() => fileRef.current?.click()}
              style={{ background: "#1A2E44" }}
            >
              {uploading ? "Uploading…" : "Change Logo"}
            </Button>

            {confirmRemove ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="danger" isLoading={removing} leftIcon={Trash2} onClick={handleRemove}>
                  Confirm Remove
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" leftIcon={X} onClick={() => setConfirmRemove(true)}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50"
              >
                Remove Logo
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Upload zone */
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && fileRef.current?.click()}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && !uploading && fileRef.current?.click()
          }
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleUpload(file);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-10 px-8 cursor-pointer select-none transition-all duration-150",
            uploading
              ? "border-[#1A7A4A]/40 bg-[#E8F5EE]/50 cursor-default"
              : dragOver
              ? "border-[#1A7A4A] bg-[#E8F5EE]/60"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          )}
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="text-[#1A7A4A] animate-spin" />
              <p className="text-sm text-[#1A7A4A] font-medium">Uploading…</p>
            </>
          ) : (
            <>
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                dragOver ? "bg-[#E8F5EE] text-[#1A7A4A]" : "bg-gray-100 text-gray-400"
              )}>
                <ImageIcon size={20} />
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-sm font-semibold transition-colors",
                  dragOver ? "text-[#1A7A4A]" : "text-gray-600"
                )}>
                  Click to upload or drag &amp; drop
                </p>
                <p className="text-xs text-gray-400 mt-1">PNG · SVG · JPEG · WebP · Max 2 MB</p>
              </div>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {uploadError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2.5 overflow-hidden"
          >
            {uploadError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── BrandVoiceSection ────────────────────────────────────────────────────────

function BrandVoiceSection({
  brand,
  onVoiceUpdate,
  onError,
}: {
  brand: Brand;
  onVoiceUpdate: (voiceSummary: string) => void;
  onError: () => void;
}) {
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { voiceSummary: string };
        error: string | null;
      }>("/api/brand/regenerate-voice");
      if (res.data.success && res.data.data?.voiceSummary) {
        onVoiceUpdate(res.data.data.voiceSummary);
      }
    } catch {
      onError();
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#E8F5EE] flex items-center justify-center shrink-0 mt-0.5">
            <Mic size={14} className="text-[#1A7A4A]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1A2E44]">Brand Voice</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              AI-generated context used in every content generation prompt
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          isLoading={regenerating}
          leftIcon={RefreshCw}
          onClick={handleRegenerate}
          className="shrink-0"
        >
          {regenerating ? "Regenerating…" : "Regenerate Brand Voice"}
        </Button>
      </div>

      {brand.voiceSummary ? (
        <p className="text-sm text-gray-600 leading-relaxed bg-[#F8FAFB] rounded-xl px-5 py-4 border border-gray-100">
          {brand.voiceSummary}
        </p>
      ) : (
        <div className="text-center py-7 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p>No voice summary yet.</p>
          <p className="text-xs mt-1 text-gray-400">
            Click &ldquo;Regenerate Brand Voice&rdquo; to generate one from your brand profile.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const storedBrand = useBrandStore((s) => s.brand);
  const setBrandStore = useBrandStore((s) => s.setBrand);

  const [brand, setBrand] = useState<Brand | null>(storedBrand);
  const [loading, setLoading] = useState(!storedBrand);

  useEffect(() => {
    if (storedBrand) {
      setBrand(storedBrand);
      setLoading(false);
      return;
    }
    apiClient
      .get<{ success: boolean; data: Brand }>("/api/brand")
      .then((res) => {
        if (res.data.success && res.data.data) {
          setBrand(res.data.data);
          setBrandStore(res.data.data);
        }
      })
      .finally(() => setLoading(false));
  }, [storedBrand, setBrandStore]);

  function handleLogoChange(newLogoUrl: string | null) {
    if (!brand) return;
    const updated = { ...brand, logoUrl: newLogoUrl };
    setBrand(updated);
    setBrandStore(updated);
    toast.success(newLogoUrl ? "Logo updated successfully!" : "Logo removed.");
  }

  function handleVoiceUpdate(voiceSummary: string) {
    if (!brand) return;
    const updated = { ...brand, voiceSummary };
    setBrand(updated);
    setBrandStore(updated);
    toast.success("Brand voice updated!");
  }

  function handleVoiceError() {
    toast.error("Failed to regenerate. Please try again.");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-[#1A7A4A]" />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-400">
        Brand not found. Complete onboarding first.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E44]">Brand Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your brand identity and preferences</p>
        </div>

        {/* Logo management */}
        <LogoSection brand={brand} onLogoChange={handleLogoChange} />

        {/* Brand voice */}
        <BrandVoiceSection
          brand={brand}
          onVoiceUpdate={handleVoiceUpdate}
          onError={handleVoiceError}
        />

        {/* Brand info (read-only summary) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-[#1A2E44] mb-4">Brand Information</h2>
          <dl className="space-y-3">
            {[
              { label: "Brand Name", value: brand.brandName },
              { label: "Industry", value: brand.industry },
              { label: "Tone of Voice", value: brand.tone },
              {
                label: "Selling Platforms",
                value: brand.platforms?.length
                  ? brand.platforms.join(" · ")
                  : "Not specified",
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-4">
                <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-36 shrink-0 pt-0.5">
                  {label}
                </dt>
                <dd className="text-sm text-[#1A2E44] flex-1 min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Brand brief */}
        {brand.brandBrief && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-[#1A2E44] mb-3">Brand Brief</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{brand.brandBrief}</p>
          </div>
        )}

        {/* Logo usage note */}
        <div className="bg-[#E8F5EE] rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1A7A4A]/10 flex items-center justify-center shrink-0 mt-0.5">
              <Check size={14} className="text-[#1A7A4A]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A2E44]">How your logo is used</p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                When the &ldquo;Include brand logo&rdquo; toggle is ON in Image Studio, your logo is composited
                at the bottom-right of every generated image with a subtle white pill background —
                giving each post a branded, professional look.
              </p>
            </div>
          </div>
        </div>
    </div>
  );
}
