"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Check, Upload, Sparkles, RefreshCw } from "lucide-react";
import Brand from "@/components/draftr/Brand";
import apiClient from "@/lib/apiClient";
import AnalysisScreen from "./AnalysisScreen";
import { isUnreachable, saveOfflineBrand, fallbackText, fileToLogoDataUrl } from "@/lib/offlineBrand";
import { useBrandStore } from "@/stores/brandStore";
import { useAuthStore } from "@/stores/authStore";
import { INDUSTRIES, PLATFORMS, TONES, MAX_TONES, type Tone } from "@/lib/brandOptions";
import type { Brand as BrandType } from "@/types";

const TOTAL_STEPS = 7;

const STEP_TITLES = ["Name", "Logo", "Industry", "Channels", "Voice", "Audience", "Online presence"];

// ─── Shared UI ────────────────────────────────────────────────────────────────

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="bd-back" onClick={onClick}>
      ← Back
    </button>
  );
}

function ContinueBtn({ label = "Continue", disabled, loading, onClick }: { label?: string; disabled?: boolean; loading?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className="bd-btn bd-btn-primary" disabled={disabled || loading} onClick={onClick}>
      {loading && <Loader2 size={17} className="bd-spin-icon" />}
      {label}
    </button>
  );
}

function SkipBtn({ onClick, label = "I'll add this later →" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="bd-linkbtn" onClick={onClick}>
      {label}
    </button>
  );
}

function ToggleTile({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={"bd-tile" + (selected ? " is-on" : "")} onClick={onClick} aria-pressed={selected}>
      {selected && <span className="tick"><Check size={11} strokeWidth={3} /></span>}
      <span>{label}</span>
    </button>
  );
}

function AiGenerateBtn({ generating, generated, onClick }: { generating: boolean; generated: boolean; onClick: () => void }) {
  return (
    <button type="button" className="bd-mini-link" onClick={onClick} disabled={generating}>
      {generating ? (
        <>
          <Loader2 size={13} className="bd-spin-icon" /> Refining…
        </>
      ) : generated ? (
        <>
          <RefreshCw size={13} /> Refine again
        </>
      ) : (
        <>
          <Sparkles size={13} /> Let AI refine this
        </>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandSetupPage() {
  const router = useRouter();
  const setBrand = useBrandStore((s) => s.setBrand);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [isChecking, setIsChecking] = useState(true);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Step 1: Brand Name
  const [brandName, setBrandName] = useState("");

  // Step 2: Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Step 3: Industry
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Step 4: Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Step 5: Tone
  const [tones, setTones] = useState<Tone[]>([]);
  const tone = tones.length ? tones.join(", ") : null; // lead tone first
  const toggleTone = (t: Tone) =>
    setTones((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= MAX_TONES ? cur : [...cur, t]));

  // Step 6: Target Audience + Brand Brief
  const [targetAudience, setTargetAudience] = useState("");
  const [brandBrief, setBrandBrief] = useState("");
  const [audienceGenerating, setAudienceGenerating] = useState(false);
  const [audienceGenerated, setAudienceGenerated] = useState(false);
  const [briefGenerating, setBriefGenerating] = useState(false);
  const [briefGenerated, setBriefGenerated] = useState(false);

  // Step 7: URLs
  const [instagramUrl, setInstagramUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState("");

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    apiClient
      .get<{ success: boolean; data: BrandType | null }>("/api/brand")
      .then((res) => {
        if (res.data.success && res.data.data) {
          router.replace("/dashboard");
        } else {
          setIsChecking(false);
        }
      })
      .catch(() => {
        setIsChecking(false);
      });
  }, [router, isAuthLoading, isAuthenticated]);

  const filteredIndustries = useMemo(
    () => (searchQuery.trim() ? INDUSTRIES.filter((i) => i.value.toLowerCase().includes(searchQuery.toLowerCase())) : INDUSTRIES),
    [searchQuery],
  );

  const resolvedIndustry = customText.trim() || selectedTile;

  function goNext() {
    setDirection(1);
    setStep((s) => s + 1);
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => s - 1);
  }

  function togglePlatform(value: string) {
    setSelectedPlatforms((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  }

  const handleLogoUpload = useCallback(async (file: File) => {
    const allowed = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setLogoUploadError("Only PNG, SVG, JPEG, and WebP are accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoUploadError("Logo must be 2 MB or smaller.");
      return;
    }
    setLogoUploading(true);
    setLogoUploadError(null);
    setLogoUrl(null);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await apiClient.post<{ success: boolean; data: { logoUrl: string }; error: string | null }>("/api/uploads/brand-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success && res.data.data) {
        setLogoUrl(res.data.data.logoUrl);
      } else {
        setLogoUploadError(res.data.error ?? "Upload failed. Please try again.");
      }
    } catch (err: unknown) {
      if (isUnreachable(err)) {
        // upload service not reachable: keep the logo in the browser so the step still completes
        try {
          setLogoUrl(await fileToLogoDataUrl(file));
        } catch {
          setLogoUploadError("Couldn't read that image. Try another file.");
        }
      } else {
        const e = err as { response?: { data?: { error?: string } } };
        setLogoUploadError(e.response?.data?.error ?? "That file couldn't be used. Try another one.");
      }
    } finally {
      setLogoUploading(false);
    }
  }, []);

  async function handleGenerateField(field: "targetAudience" | "brandBrief") {
    if (!resolvedIndustry || !tone) return;
    if (field === "targetAudience") setAudienceGenerating(true);
    else setBriefGenerating(true);

    try {
      const res = await apiClient.post<{ success: boolean; data: { text: string }; error: string | null }>("/api/brand/generate-field", {
        brandName: brandName.trim() || "My Brand",
        industry: resolvedIndustry,
        tone,
        platforms: selectedPlatforms,
        field,
        draft: (field === "targetAudience" ? targetAudience : brandBrief).trim() || undefined,
      });

      const text = res.data.success && res.data.data?.text ? res.data.data.text : fallbackText(field, { brandName, industry: resolvedIndustry, tone, platforms: selectedPlatforms }, field === "targetAudience" ? targetAudience : brandBrief);
      if (field === "targetAudience") {
        setTargetAudience(text);
        setAudienceGenerated(true);
      } else {
        setBrandBrief(text.slice(0, 500));
        setBriefGenerated(true);
      }
    } catch {
      // AI service unavailable: write a sensible starting draft locally the user can edit
      const text = fallbackText(field, { brandName, industry: resolvedIndustry, tone, platforms: selectedPlatforms }, field === "targetAudience" ? targetAudience : brandBrief);
      if (field === "targetAudience") {
        setTargetAudience(text);
        setAudienceGenerated(true);
      } else {
        setBrandBrief(text.slice(0, 500));
        setBriefGenerated(true);
      }
    } finally {
      if (field === "targetAudience") setAudienceGenerating(false);
      else setBriefGenerating(false);
    }
  }

  async function handleSubmit(opts?: { instagramUrl?: string; websiteUrl?: string; googleBusinessUrl?: string }) {
    if (!resolvedIndustry || !tone) return;
    setApiError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: BrandType; error: string | null }>("/api/brand", {
        brandName: brandName.trim(),
        industry: resolvedIndustry,
        targetAudience: targetAudience.trim(),
        tone,
        platforms: selectedPlatforms,
        brandBrief: brandBrief.trim() || undefined,
        logoUrl: logoUrl || undefined,
        instagramUrl: opts?.instagramUrl || undefined,
        websiteUrl: opts?.websiteUrl || undefined,
        googleBusinessUrl: opts?.googleBusinessUrl || undefined,
      });
      if (res.data.success) {
        setBrand(res.data.data);
        router.push("/strategy");
      }
    } catch (err: unknown) {
      if (isUnreachable(err)) {
        // server not reachable: keep the brand in this browser and carry on to the dashboard
        const local: BrandType = {
          id: "local-" + Date.now(),
          userId: "local",
          brandName: brandName.trim(),
          industry: resolvedIndustry,
          tone,
          targetAudience: targetAudience.trim(),
          logoUrl: logoUrl || null,
          platforms: selectedPlatforms,
          brandBrief: brandBrief.trim() || null,
          strategyApproved: false,
        };
        saveOfflineBrand(local);
        setBrand(local);
        router.push("/dashboard");
      } else {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setApiError(message ?? "Please check your details and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <div className="bd-center-screen">
        <div className="bd-spinner" />
      </div>
    );
  }

  const initial = (brandName.trim()[0] ?? "B").toUpperCase();
  const toneInfo = tones.length ? { value: tones.join(" · ") } : null;

  return (
    <div className="bd-onb-grid">
      {/* live preview */}
      <aside className="bd-onb-side">
        <div style={{ height: 34 }}>
          <a href="/" aria-label="BrandefAI home" style={{ display: "block", height: "100%" }}>
            <Brand tone="light" size={22} />
          </a>
        </div>

        <div>
          <h2>Let&apos;s build your brand profile</h2>
          <p className="sub">It takes about two minutes. Everything BrandefAI writes and creates will be based on it.</p>
        </div>

        <div className="bd-onb-preview" aria-label="Brand preview">
          <div className="top">
            <div className="bd-onb-logo">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" />
              ) : (
                initial
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brandName.trim() || "Your brand"}</h3>
              <span className="bd-hint">{resolvedIndustry ?? "Industry"}</span>
            </div>
          </div>
          <div className="row">
            {toneInfo ? <span className="bd-chip p">{toneInfo.value}</span> : <span className="bd-chip">Voice</span>}
            {selectedPlatforms.slice(0, 3).map((p) => (
              <span key={p} className="bd-chip">{p}</span>
            ))}
            {selectedPlatforms.length > 3 && <span className="bd-chip">+{selectedPlatforms.length - 3}</span>}
          </div>
          <p className="quote">
            {targetAudience.trim() ? targetAudience.trim().slice(0, 140) + (targetAudience.length > 140 ? "…" : "") : "Your audience description will appear here."}
          </p>
        </div>
      </aside>

      {/* wizard */}
      <main className="bd-onb-main">
        <div className="bd-onb-top">
          <div className="bd-stepper" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step}>
            <b>Step {step} of {TOTAL_STEPS}</b>
            <div className="bar"><span style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} /></div>
          </div>
          <span className="bd-chip">{STEP_TITLES[step - 1]}</span>
        </div>

        <div className="bd-onb-body">
          <div key={step} className={"bd-wizard" + (direction < 0 ? " back" : "")}>
            {/* ── STEP 1: Brand Name ───────────────────────────────────── */}
            {step === 1 && (
              <div>
                <h1>What&apos;s your brand called?</h1>
                <p className="lead">This is the name that will appear on all your generated content.</p>
                <div className="bd-field">
                  <label className="bd-label" htmlFor="bs-name">Brand name</label>
                  <input
                    id="bs-name"
                    className="bd-input"
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Urban Threads"
                    maxLength={80}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && brandName.trim().length >= 2) goNext();
                    }}
                  />
                </div>
                <div className="bd-wiz-actions">
                  <ContinueBtn disabled={brandName.trim().length < 2} onClick={goNext} />
                </div>
              </div>
            )}

            {/* ── STEP 2: Logo Upload ──────────────────────────────────── */}
            {step === 2 && (
              <div>
                <BackBtn onClick={goBack} />
                <h1>Upload your brand logo</h1>
                <p className="lead">PNG or SVG with a transparent background works best. Max 2 MB.</p>

                <input
                  ref={logoFileRef}
                  type="file"
                  hidden
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                />

                {!logoUrl ? (
                  <div
                    className={"bd-drop" + (logoDragOver ? " is-over" : "")}
                    role="button"
                    tabIndex={0}
                    onClick={() => !logoUploading && logoFileRef.current?.click()}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !logoUploading && logoFileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setLogoDragOver(true); }}
                    onDragLeave={() => setLogoDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setLogoDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  >
                    {logoUploading ? (
                      <>
                        <Loader2 size={28} className="bd-spin-icon" style={{ color: "var(--p)" }} />
                        <b>Uploading…</b>
                      </>
                    ) : (
                      <>
                        <span className="ico"><Upload size={24} /></span>
                        <b>Click to upload or drag &amp; drop</b>
                        <span>PNG · SVG · JPEG · WebP</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="bd-logo-box">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUrl} alt="Logo on light background" />
                      </div>
                      <div className="bd-logo-box dark">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUrl} alt="Logo on dark background" />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <span className="bd-chip g"><Check size={12} strokeWidth={3} /> Logo uploaded</span>
                      <button
                        type="button"
                        className="bd-linkbtn"
                        onClick={() => {
                          setLogoUrl(null);
                          setLogoUploadError(null);
                          if (logoFileRef.current) logoFileRef.current.value = "";
                        }}
                      >
                        Remove logo
                      </button>
                    </div>
                  </div>
                )}

                {logoUploadError && <p className="bd-error">{logoUploadError}</p>}

                <div className="bd-wiz-actions">
                  <ContinueBtn disabled={logoUploading} onClick={goNext} />
                  <SkipBtn onClick={goNext} />
                </div>
              </div>
            )}

            {/* ── STEP 3: Industry ─────────────────────────────────────── */}
            {step === 3 && (
              <div>
                <BackBtn onClick={goBack} />
                <h1>What industry are you in?</h1>
                <p className="lead">Pick a category, or type your exact niche below.</p>

                <div className="bd-search">
                  <Search size={16} />
                  <input className="bd-input" type="text" placeholder="Search industries…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>

                <div className="bd-tiles">
                  {filteredIndustries.map((ind) => {
                    const isSelected = selectedTile === ind.value && !customText.trim();
                    return (
                      <ToggleTile
                        key={ind.value}
                        label={ind.value}
                        selected={isSelected}
                        onClick={() => {
                          setSelectedTile(ind.value);
                          setCustomText("");
                          setSearchQuery("");
                        }}
                      />
                    );
                  })}
                  {filteredIndustries.length === 0 && <div className="bd-empty" style={{ gridColumn: "1 / -1" }}>No match. Type your industry in the field below.</div>}
                </div>

                <div className="bd-field" style={{ marginTop: 22 }}>
                  <label className="bd-label" htmlFor="bs-custom">My industry isn&apos;t listed</label>
                  <input
                    id="bs-custom"
                    className="bd-input"
                    type="text"
                    placeholder="e.g. Organic cotton kidswear, pet accessories…"
                    value={customText}
                    onChange={(e) => {
                      setCustomText(e.target.value);
                      if (e.target.value.trim()) setSelectedTile(null);
                    }}
                    maxLength={100}
                  />
                  {customText.trim() && <p className="bd-hint">Will be saved as &ldquo;{customText.trim()}&rdquo;</p>}
                </div>

                <div className="bd-wiz-actions">
                  <ContinueBtn disabled={!resolvedIndustry} onClick={goNext} />
                </div>
              </div>
            )}

            {/* ── STEP 4: Where do you sell? ───────────────────────────── */}
            {step === 4 && (
              <div>
                <BackBtn onClick={goBack} />
                <h1>Where do you sell?</h1>
                <p className="lead">Select all that apply. This helps tailor your content formats.</p>

                <div className="bd-tiles">
                  {PLATFORMS.map((p) => (
                    <ToggleTile key={p.value} label={p.value} selected={selectedPlatforms.includes(p.value)} onClick={() => togglePlatform(p.value)} />
                  ))}
                </div>

                {selectedPlatforms.length > 0 && (
                  <p className="bd-hint" style={{ marginTop: 14 }}>
                    {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? "s" : ""} selected
                  </p>
                )}

                <div className="bd-wiz-actions">
                  <ContinueBtn onClick={goNext} />
                  <SkipBtn onClick={goNext} />
                </div>
              </div>
            )}

            {/* ── STEP 5: Brand Voice ──────────────────────────────────── */}
            {step === 5 && (
              <div>
                <BackBtn onClick={goBack} />
                <h1>What is your brand&apos;s voice?</h1>
                <p className="lead">Choose up to {MAX_TONES} tones that sound like you. The first one you pick leads, the others add flavour. You can change this later in Settings.</p>

                <p className="bd-tone-count" aria-live="polite">{tones.length} of {MAX_TONES} selected</p>
                <div className="bd-tones">
                  {TONES.map((t) => {
                    const idx = tones.indexOf(t.value);
                    const on = idx >= 0;
                    const full = !on && tones.length >= MAX_TONES;
                    return (
                      <button key={t.value} type="button" className={"bd-tone" + (on ? " is-on" : "")} onClick={() => toggleTone(t.value)} aria-pressed={on} disabled={full}>
                        <span className="th">
                          <b>{t.value}</b>
                          {on && <span className="ord">{idx === 0 ? "Lead" : idx + 1}</span>}
                        </span>
                        <span className="tg">{t.tagline}</span>
                        <span className="dt">{t.detail}</span>
                        <span className="bf">Best for: {t.bestFor}</span>
                        <span className="ex">&ldquo;{t.example}&rdquo;</span>
                      </button>
                    );
                  })}
                </div>

                <div className="bd-wiz-actions">
                  <ContinueBtn disabled={tones.length === 0} onClick={goNext} />
                </div>
              </div>
            )}

            {/* ── STEP 6: Target Audience + Brand Brief ────────────────── */}
            {step === 6 && (
              <div>
                <BackBtn onClick={goBack} />
                <h1>Tell us about your audience</h1>
                <p className="lead">The more specific you are, the better the AI output.</p>

                <div className="bd-field">
                  <div className="bd-labelrow">
                    <label className="bd-label" htmlFor="bs-aud">Who are you trying to reach?</label>
                    <AiGenerateBtn generating={audienceGenerating} generated={audienceGenerated} onClick={() => handleGenerateField("targetAudience")} />
                  </div>
                  <textarea
                    id="bs-aud"
                    className="bd-textarea"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value.slice(0, 400))}
                    rows={4}
                    maxLength={400}
                    placeholder="e.g. Women aged 25-40 who care about sustainable fashion and shop online for premium everyday wear…"
                  />
                  <div className="bd-count" style={{ textAlign: "right" }}>{targetAudience.length}/400</div>
                </div>

                <div className="bd-field">
                  <div className="bd-labelrow">
                    <label className="bd-label" htmlFor="bs-brief">Brand brief <span className="bd-hint" style={{ fontWeight: 500 }}>— optional</span></label>
                    <AiGenerateBtn generating={briefGenerating} generated={briefGenerated} onClick={() => handleGenerateField("brandBrief")} />
                  </div>
                  <textarea
                    id="bs-brief"
                    className="bd-textarea"
                    value={brandBrief}
                    onChange={(e) => setBrandBrief(e.target.value.slice(0, 500))}
                    rows={4}
                    maxLength={500}
                    placeholder="What does your brand do, sell, or stand for? e.g. We make sustainable activewear for women who want to look good and do good."
                  />
                  <div className="bd-count" style={{ textAlign: "right" }}>{brandBrief.length}/500</div>
                </div>

                <div className="bd-wiz-actions">
                  <ContinueBtn disabled={targetAudience.trim().length < 10} onClick={goNext} />
                </div>
              </div>
            )}

            {/* ── STEP 7: URL Enrichment ───────────────────────────────── */}
            {step === 7 && analysing && (
              <AnalysisScreen
                brandName={brandName.trim()}
                industry={resolvedIndustry ?? ""}
                instagramUrl={instagramUrl.trim()}
                websiteUrl={websiteUrl.trim()}
                googleBusinessUrl={googleBusinessUrl.trim()}
                audience={targetAudience.trim()}
                brief={brandBrief.trim()}
                submitting={isSubmitting}
                error={apiError}
                onBack={() => setAnalysing(false)}
                onContinue={() =>
                  handleSubmit({
                    instagramUrl: instagramUrl.trim() || undefined,
                    websiteUrl: websiteUrl.trim() || undefined,
                    googleBusinessUrl: googleBusinessUrl.trim() || undefined,
                  })
                }
              />
            )}

            {step === 7 && !analysing && (
              <div>
                <BackBtn onClick={goBack} />
                <h1>Let us find your brand online</h1>
                <p className="lead">We&apos;ll analyse your pages to build a richer brand profile. Completely optional.</p>

                <div className="bd-field">
                  <label className="bd-label" htmlFor="bs-ig">Instagram profile</label>
                  <div className="bd-iconfield">
                    <input id="bs-ig" className="bd-input" type="url" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/yourbrand" />
                  </div>
                </div>
                <div className="bd-field">
                  <label className="bd-label" htmlFor="bs-web">Website</label>
                  <div className="bd-iconfield">
                    <input id="bs-web" className="bd-input" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourbrand.com" />
                  </div>
                </div>
                <div className="bd-field">
                  <label className="bd-label" htmlFor="bs-gbp">Google Business Profile</label>
                  <div className="bd-iconfield">
                    <input id="bs-gbp" className="bd-input" type="url" value={googleBusinessUrl} onChange={(e) => setGoogleBusinessUrl(e.target.value)} placeholder="https://maps.google.com/maps?cid=..." />
                  </div>
                  <p className="bd-hint">We&apos;ll extract your address, phone number, opening hours and customer reviews to use in promotional posts and infographics.</p>
                </div>

                {apiError && <p className="bd-error">{apiError}</p>}

                <div className="bd-wiz-actions">
                  <ContinueBtn label="Analyse my brand →" onClick={() => { setApiError(null); setAnalysing(true); }} />
                  <SkipBtn label="Skip for now" onClick={() => !isSubmitting && handleSubmit()} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
