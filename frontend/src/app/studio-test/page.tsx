"use client";

/**
 * /studio-test — Isolated pipeline test page.
 *
 * Fully self-contained: no shared components, no nav link, no auth.
 * Calls POST /api/studio-test/generate with multipart form data.
 * Renders raw model output + composited output side-by-side for both
 * Flux 2 Pro and Ideogram v3.
 */

import { useState, useRef, useCallback, type FormEvent, type ChangeEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreativeAnalysis {
  productType:    string;
  bodyPart:       string;
  placementNotes: string;
  postType:       "lifestyle" | "product_highlight";
  storyAngle:     string;
  headline:       string;
  accentLine?:    string;
  subheadline:    string;
  cta:            string;
  trustBullets:   string[];
  trustIcons?:    string[];
  orientation?:   string;
  layoutId?:      string;
  fontPairingId?: string;
  sceneMood?:     string;
}

interface ResponseData {
  productImageUrl: string;
  logoUrl?: string;
  bgRemovalPath?: "cutout" | "fallback";
  compositedUrl: string;
  backgroundId?: string;
  backgroundTone?: string;
  templateId?: string;
  creativeAnalysis?: CreativeAnalysis;
  logs: string[];
}

interface ApiResponse {
  success: boolean;
  data: ResponseData | null;
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://brandefai-production.up.railway.app";

const INDUSTRIES = [
  { value: "jewellery",     label: "Jewellery" },
  { value: "food_desserts", label: "Food & Desserts" },
  { value: "lifestyle",     label: "Lifestyle / Generic" },
] as const;

// ─── Utility styles ───────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    background: "#0c0c0c",
    color: "#e8e8e8",
    fontFamily: "'Inter', system-ui, -apple-system, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
    padding: "36px 28px",
  } satisfies React.CSSProperties,

  wrap: {
    maxWidth: 1200,
    margin: "0 auto",
  } satisfies React.CSSProperties,

  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#888",
    marginBottom: 6,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  } satisfies React.CSSProperties,

  input: {
    width: "100%",
    padding: "10px 13px",
    background: "#1c1c1c",
    border: "1px solid #2e2e2e",
    borderRadius: 8,
    color: "#e8e8e8",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
  } satisfies React.CSSProperties,

  btn: (disabled: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "13px 20px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "#222" : "#1A7A4A",
    color: disabled ? "#555" : "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.2s",
    marginTop: 8,
  }),
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PromoImage({ url }: { url: string }) {
  const [err, setErr] = useState(false);
  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <p style={{
        fontSize: 11, fontWeight: 700, color: "#1A7A4A",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12,
      }}>
        Promo Post ✦
      </p>
      {err ? (
        <div style={{
          aspectRatio: "1/1", background: "#1a1a1a", borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#555", fontSize: 13,
        }}>
          Image failed to load
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Promo post"
          onError={() => setErr(true)}
          style={{ width: "100%", borderRadius: 12, border: "1px solid #2e2e2e", display: "block" }}
        />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-block", marginTop: 10, color: "#1A7A4A", fontSize: 12, textDecoration: "none" }}>
        Open full size ↗
      </a>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ stage }: { stage: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: "#666",
        fontSize: 15,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #2e2e2e",
          borderTop: "3px solid #1A7A4A",
          borderRadius: "50%",
          animation: "spin 0.9s linear infinite",
          margin: "0 auto 20px",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ margin: 0, fontWeight: 600, color: "#aaa" }}>{stage}</p>
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        60–90 seconds — deep product inspection → creative brief → compositing
      </p>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function StudioTestPage() {
  const [brandName,    setBrandName]    = useState("BranDeFAI Studio");
  const [brandTagline, setBrandTagline] = useState("Crafted with love, worn forever");
  const [industry,     setIndustry]     = useState<string>("jewellery");
  const [tone,         setTone]         = useState("Luxury, Elegant, Premium");
  const [primaryColor, setPrimaryColor] = useState("#1A7A4A");
  const [accentColor,  setAccentColor]  = useState("#FFD700");
  const [productFile,    setProductFile]    = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [logoFile,       setLogoFile]       = useState<File | null>(null);
  const [logoPreview,    setLogoPreview]    = useState<string | null>(null);

  const [loading,  setLoading]  = useState(false);
  const [stage,    setStage]    = useState("Generating…");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  // Stable per page-mount — drives template rotation on the backend so
  // repeated generates from the same form session pick different variants.
  const testSessionId = useRef(crypto.randomUUID()).current;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setProductFile(f);
    setProductPreview(URL.createObjectURL(f));
  }

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  }

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!productFile) { setError("Upload a product photo first."); return; }
      if (!brandName.trim()) { setError("Brand name is required."); return; }

      setLoading(true);
      setError(null);
      setResponse(null);
      setStage("Uploading product photo…");

      try {
        const form = new FormData();
        form.append("brandName",     brandName.trim());
        form.append("brandTagline",  brandTagline.trim());
        form.append("industry",      industry);
        form.append("tone",          tone.trim());
        form.append("primaryColor",  primaryColor);
        form.append("accentColor",   accentColor);
        form.append("testSessionId", testSessionId);
        form.append("image", productFile, productFile.name);
        // Logo is optional — backend shows brand initials if absent
        if (logoFile) form.append("logo", logoFile, logoFile.name);

        setStage("Stage 1: Inspecting product image in detail… (45s)");

        const res = await fetch(`${API_BASE}/api/studio-test/generate`, {
          method: "POST",
          body: form,
          // No Content-Type header — browser sets multipart boundary automatically
        });

        const json: ApiResponse = await res.json().catch(() => ({
          success: false,
          data: null,
          error: `HTTP ${res.status} — non-JSON response`,
        }));

        if (!res.ok || !json.success) {
          setError(json.error ?? `HTTP ${res.status}`);
          return;
        }

        setResponse(json);
        setStage("Done!");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [brandName, brandTagline, industry, tone, primaryColor, accentColor, productFile, logoFile],
  );

  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: "#fff",
              margin: "0 0 6px",
            }}
          >
            Studio Test
          </h1>
          <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
            Isolated pipeline · Blurred-original backdrop · BiRefNet + GPT-4o
          </p>
        </div>

        {/* ── Form ────────────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
            marginBottom: 44,
          }}
        >
          {/* Left: brand fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={S.label}>Brand Name</label>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                style={S.input}
                placeholder="Your brand name"
                required
              />
            </div>

            <div>
              <label style={S.label}>Brand Tagline</label>
              <input
                value={brandTagline}
                onChange={(e) => setBrandTagline(e.target.value)}
                style={S.input}
                placeholder="Crafted with love, worn forever"
              />
            </div>

            <div>
              <label style={S.label}>Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                style={S.input}
              >
                {INDUSTRIES.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={S.label}>Tone Adjectives (comma-separated)</label>
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                style={S.input}
                placeholder="Luxury, Elegant, Modern"
                required
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div>
                <label style={S.label}>Primary Color</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{
                      width: 40,
                      height: 36,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: "none",
                      padding: 0,
                    }}
                  />
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{ ...S.input, flex: 1 }}
                    placeholder="#1A7A4A"
                  />
                </div>
              </div>
              <div>
                <label style={S.label}>Accent Color</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={{
                      width: 40,
                      height: 36,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: "none",
                      padding: 0,
                    }}
                  />
                  <input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={{ ...S.input, flex: 1 }}
                    placeholder="#FFD700"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: upload boxes (product + logo) + submit */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Product + logo side-by-side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

              {/* Product photo */}
              <div>
                <label style={S.label}>Product Photo ★</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: "2px dashed #2e2e2e",
                    borderRadius: 12,
                    padding: productPreview ? "8px" : "28px 12px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "#141414",
                    minHeight: 140,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {productPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productPreview}
                      alt="Product preview"
                      style={{
                        maxHeight: 150,
                        maxWidth: "100%",
                        objectFit: "contain",
                        borderRadius: 6,
                      }}
                    />
                  ) : (
                    <>
                      <div style={{ fontSize: 24 }}>📸</div>
                      <div style={{ color: "#555", fontSize: 12 }}>
                        Upload product
                        <br />
                        <span style={{ fontSize: 11 }}>JPEG/PNG/WebP</span>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                {productFile && (
                  <p style={{ color: "#555", fontSize: 11, marginTop: 5 }}>
                    {productFile.name.slice(0, 20)}{productFile.name.length > 20 ? "…" : ""}{" "}
                    ({(productFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>

              {/* Brand logo (optional) */}
              <div>
                <label style={S.label}>
                  Brand Logo{" "}
                  <span style={{ color: "#444", fontWeight: 400, textTransform: "none" }}>
                    optional
                  </span>
                </label>
                <div
                  onClick={() => logoRef.current?.click()}
                  style={{
                    border: `2px dashed ${logoPreview ? "#1A7A4A" : "#2e2e2e"}`,
                    borderRadius: 12,
                    padding: logoPreview ? "8px" : "28px 12px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "#141414",
                    minHeight: 140,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      style={{
                        maxHeight: 80,
                        maxWidth: "100%",
                        objectFit: "contain",
                        borderRadius: 4,
                      }}
                    />
                  ) : (
                    <>
                      <div style={{ fontSize: 24 }}>🏷️</div>
                      <div style={{ color: "#555", fontSize: 12 }}>
                        Upload logo
                        <br />
                        <span style={{ fontSize: 11 }}>PNG preferred</span>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoChange}
                  style={{ display: "none" }}
                />
                {logoFile ? (
                  <p style={{ color: "#1A7A4A", fontSize: 11, marginTop: 5 }}>
                    ✓ {logoFile.name.slice(0, 20)}{logoFile.name.length > 20 ? "…" : ""}
                  </p>
                ) : (
                  <p style={{ color: "#444", fontSize: 11, marginTop: 5 }}>
                    Sacred — overlaid on composited only
                  </p>
                )}
              </div>

            </div>

            <button
              type="submit"
              disabled={loading || !productFile}
              style={S.btn(loading || !productFile)}
            >
              {loading
                ? `⏳ ${stage}`
                : "🚀 Generate Promo Post"}
            </button>
          </div>
        </form>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div
            style={{
              background: "#1a0a0a",
              border: "1px solid #4a1010",
              borderRadius: 10,
              padding: "14px 18px",
              marginBottom: 32,
              color: "#ff7070",
              fontSize: 14,
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && <Spinner stage={stage} />}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {!loading && response?.data && (
          <div>
            {/* Meta */}
            {/* Meta strip */}
            <div
              style={{
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
                marginBottom: 28,
                padding: "14px 18px",
                background: "#141414",
                borderRadius: 10,
                border: "1px solid #2e2e2e",
              }}
            >
              {response.data.templateId && (
                <Meta label="Template" value={response.data.templateId} />
              )}
              {response.data.creativeAnalysis && (
                <>
                  <Meta label="Post Type"    value={response.data.creativeAnalysis.postType} />
                  {response.data.creativeAnalysis.layoutId && (
                    <Meta label="Layout" value={response.data.creativeAnalysis.layoutId} />
                  )}
                  {response.data.creativeAnalysis.fontPairingId && (
                    <Meta label="Fonts" value={response.data.creativeAnalysis.fontPairingId} />
                  )}
                  {response.data.creativeAnalysis.sceneMood && (
                    <Meta
                      label="Backdrop"
                      value={`${response.data.creativeAnalysis.sceneMood}${response.data.backgroundId ? ` → ${response.data.backgroundId}` : " → fallback (no library)"}`}
                    />
                  )}
                  <Meta label="Story Angle"  value={response.data.creativeAnalysis.storyAngle} />
                  <Meta
                    label="Headline"
                    value={`${response.data.creativeAnalysis.headline}${response.data.creativeAnalysis.accentLine ? ` / ${response.data.creativeAnalysis.accentLine}` : ""}`}
                  />
                  <Meta label="CTA"          value={response.data.creativeAnalysis.cta} />
                  <Meta label="Product Type" value={`${response.data.creativeAnalysis.productType}${response.data.creativeAnalysis.orientation ? ` (${response.data.creativeAnalysis.orientation})` : ""}`} />
                  {response.data.creativeAnalysis.trustBullets.length > 0 && (
                    <Meta
                      label="Trust Bullets"
                      value={response.data.creativeAnalysis.trustBullets
                        .map((b, k) => {
                          const icon = response.data?.creativeAnalysis?.trustIcons?.[k];
                          return icon ? `${b} [${icon}]` : b;
                        })
                        .join(" · ")}
                    />
                  )}
                </>
              )}
              {response.data.bgRemovalPath && (
                <div
                  style={{
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    alignSelf: "center",
                    background:
                      response.data.bgRemovalPath === "cutout"
                        ? "rgba(26,122,74,0.18)"
                        : "rgba(180,80,0,0.18)",
                    color:
                      response.data.bgRemovalPath === "cutout"
                        ? "#1A7A4A"
                        : "#cc6600",
                    border: `1px solid ${response.data.bgRemovalPath === "cutout" ? "#1A7A4A55" : "#cc660055"}`,
                  }}
                >
                  {response.data.bgRemovalPath === "cutout"
                    ? "BiRefNet cutout"
                    : "fallback (original)"}
                </div>
              )}
              <a
                href={response.data.productImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#1A7A4A", fontSize: 13, alignSelf: "center" }}
              >
                Product ↗
              </a>
              {response.data.logoUrl && (
                <a
                  href={response.data.logoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1A7A4A", fontSize: 13, alignSelf: "center" }}
                >
                  Logo ↗
                </a>
              )}
            </div>

            {/* Single promo post image */}
            <PromoImage url={response.data.compositedUrl} />

            {/* Server logs */}
            <details style={{ marginTop: 32 }}>
              <summary
                style={{
                  color: "#555",
                  cursor: "pointer",
                  fontSize: 12,
                  userSelect: "none",
                  letterSpacing: "0.05em",
                }}
              >
                Server logs ({response.data.logs.length} lines)
              </summary>
              <div
                style={{
                  background: "#0a0a0a",
                  borderRadius: 8,
                  padding: "14px 16px",
                  marginTop: 10,
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "#0cf",
                  overflowX: "auto",
                  border: "1px solid #1e1e1e",
                  maxHeight: 420,
                  overflowY: "auto",
                }}
              >
                {response.data.logs.map((line, i) => (
                  <div key={i} style={{ paddingBottom: 3 }}>
                    {line}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#555",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: "0 0 3px",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 14, color: "#ddd", margin: 0 }}>{value}</p>
    </div>
  );
}
