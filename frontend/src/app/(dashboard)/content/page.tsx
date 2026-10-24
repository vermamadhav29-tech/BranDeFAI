"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, Check, Download, Loader2, Sparkles, ArrowRight, Image as ImageIcon, X, Layers } from "lucide-react";
import apiClient from "@/lib/apiClient";

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

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button type="button" className={"bd-btn bd-btn-sm " + (copied ? "bd-btn-green" : "bd-btn-ghost")} onClick={handleCopy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied!" : label}
    </button>
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
      <div className="bd-shot missing">
        <div>
          <X size={20} style={{ marginBottom: 6 }} />
          <div>Image not available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bd-shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Generated image ${index + 1}`} loading="lazy" />
      <div className="over">
        <button type="button" className="bd-btn bd-btn-sm" style={{ background: "#fff", color: "var(--ink)" }} onClick={handleDownload} disabled={downloading}>
          {downloading ? <Loader2 size={14} className="bd-spin-icon" /> : <Download size={14} />} Download
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────────

const fmt = (iso: string, long = false) =>
  new Date(iso).toLocaleDateString("en-US", long ? { month: "long", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });

export default function ContentPage() {
  const [packs, setPacks] = useState<ContentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: { items: ContentRecord[]; total: number } }>("/api/content?limit=20")
      .then((res) => {
        if (res.data.success && res.data.data) {
          setPacks(res.data.data.items ?? []);
          setTotal(res.data.data.total ?? res.data.data.items?.length ?? 0);
          setSelectedId(res.data.data.items?.[0]?.id ?? null);
        } else {
          setError("Could not load your content.");
        }
      })
      .catch(() => setError("Could not load your content."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bd-flow" aria-busy="true">
        <div className="bd-pagehead"><div><div className="bd-skel" style={{ width: 300, height: 34, borderRadius: 12 }} /></div></div>
        <div className="bd-split">
          <div className="bd-card" style={{ display: "grid", gap: 14 }}>
            {[0, 1, 2].map((i) => <div key={i} className="bd-skel" style={{ height: 90, borderRadius: 18 }} />)}
          </div>
          <div className="bd-card" style={{ display: "grid", gap: 12 }}>
            {[0, 1, 2].map((i) => <div key={i} className="bd-skel" style={{ height: 52, borderRadius: 16 }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bd-card" style={{ maxWidth: 560 }}>
        <div className="bd-empty">
          <strong>{error}</strong>
          <button type="button" className="bd-btn bd-btn-dark bd-btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="bd-flow">
        <div className="bd-pagehead">
          <div>
            <h1>Generated content</h1>
            <p>Captions, ad copy, reel ideas and images created for your brand.</p>
          </div>
        </div>
        <div className="bd-card" style={{ textAlign: "center", padding: "56px 24px" }}>
          <span className="bd-stat-ico" style={{ width: 64, height: 64, borderRadius: 22, margin: "0 auto 18px", background: "var(--tint)", color: "var(--p)" }}>
            <ImageIcon size={28} />
          </span>
          <h2 className="bd-card-title" style={{ fontSize: 24 }}>No content generated yet</h2>
          <p className="bd-card-sub" style={{ maxWidth: 420, margin: "8px auto 22px" }}>
            Upload a product image on the dashboard and generate your first content pack. It takes about a minute.
          </p>
          <Link href="/dashboard" className="bd-btn bd-btn-primary">
            Go to dashboard <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const content = packs.find((p) => p.id === selectedId) ?? packs[0];
  const images = content.images ?? [null, null];
  const captions = (content.captions ?? []) as string[];
  const adCopy = content.adCopy as AdCopy | null;
  const reels = (content.reelIdeas ?? []) as ReelIdea[];
  const allText = [
    ...captions.map((c, i) => `Caption ${i + 1}\n${c}`),
    adCopy ? `Ad copy\n${adCopy.headline}\n\n${adCopy.body}\n\n${adCopy.cta}` : "",
    ...reels.map((r, i) => `Reel idea ${i + 1}\n"${r.hook}"\n${r.shotList.map((s, j) => `${j + 1}. ${s}`).join("\n")}`),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return (
    <div className="bd-flow">
      <div className="bd-pagehead">
        <div>
          <h1>Generated content</h1>
          <p>
            {total} content pack{total === 1 ? "" : "s"} · copy it, download it, or schedule it from the calendar.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <CopyButton text={allText} label="Copy everything" />
          <Link href="/dashboard" className="bd-btn bd-btn-primary">
            <Sparkles size={16} /> Generate new
          </Link>
        </div>
      </div>

      <div className="bd-split">
        <div className="bd-flow" key={content.id}>
          {/* Captions */}
          {captions.length > 0 && (
            <section className="bd-card bd-reveal">
              <div className="bd-card-head">
                <div>
                  <h2 className="bd-card-title">Instagram captions</h2>
                  <p className="bd-card-sub">Pick your favourite. Each one is written in your brand voice.</p>
                </div>
                <span className="bd-chip p">{fmt(content.createdAt, true)}</span>
              </div>
              <div className="bd-caps">
                {captions.map((caption, i) => (
                  <div key={i} className="bd-cap">
                    <span className="no">{i + 1}</span>
                    <p>{caption}</p>
                    <div className="foot">
                      <span className="bd-count">{caption.length} chars</span>
                      <CopyButton text={caption} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ad copy */}
          {adCopy && (
            <section className="bd-card bd-reveal">
              <div className="bd-card-head">
                <div>
                  <h2 className="bd-card-title">Ad copy</h2>
                  <p className="bd-card-sub">Ready for Meta and Google ads.</p>
                </div>
              </div>
              <div className="bd-adcopy">
                <h3>{adCopy.headline}</h3>
                <p>{adCopy.body}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <span className="bd-chip g">CTA: {adCopy.cta}</span>
                  <CopyButton text={`${adCopy.headline}\n\n${adCopy.body}\n\n${adCopy.cta}`} />
                </div>
              </div>
            </section>
          )}

          {/* Reel ideas */}
          {reels.length > 0 && (
            <section className="bd-card bd-reveal">
              <div className="bd-card-head">
                <div>
                  <h2 className="bd-card-title">Reel ideas</h2>
                  <p className="bd-card-sub">A hook and a shot-by-shot plan for each idea.</p>
                </div>
              </div>
              <div className="bd-grid-2">
                {reels.map((idea, i) => (
                  <div key={i} className="bd-reel">
                    <q>{idea.hook}</q>
                    <ol className="bd-shots">
                      {idea.shotList.map((shot, j) => (
                        <li key={j}>{shot}</li>
                      ))}
                    </ol>
                    <div style={{ marginTop: 16 }}>
                      <CopyButton text={`"${idea.hook}"\n${idea.shotList.map((s, j) => `${j + 1}. ${s}`).join("\n")}`} label="Copy plan" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Images */}
          <section className="bd-card bd-reveal">
            <div className="bd-card-head">
              <div>
                <h2 className="bd-card-title">AI-generated visuals</h2>
                <p className="bd-card-sub">Hover an image to download it.</p>
              </div>
            </div>
            <div className="bd-gallery">
              {images.map((url, i) => (
                <SavedImageCard key={i} url={url} index={i} />
              ))}
            </div>
          </section>
        </div>

        {/* History */}
        <aside className="bd-card bd-sticky bd-reveal">
          <div className="bd-card-head" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="bd-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={18} style={{ color: "var(--p)" }} /> History
              </h2>
              <p className="bd-card-sub">Your recent content packs</p>
            </div>
          </div>
          <div className="bd-hist">
            {packs.map((p, i) => (
              <button key={p.id} type="button" className={p.id === content.id ? "is-on" : ""} onClick={() => setSelectedId(p.id)}>
                <span className="bd-avatar" style={{ width: 40, height: 40, borderRadius: 14, background: p.id === content.id ? "var(--p)" : "var(--bg)", color: p.id === content.id ? "#fff" : "var(--gray)" }}>
                  {total - i}
                </span>
                <span className="t">
                  <b>{(p.captions?.[0] ?? "Content pack").slice(0, 38)}</b>
                  <span>{fmt(p.createdAt)} · {(p.captions?.length ?? 0)} captions · {(p.reelIdeas?.length ?? 0)} reels</span>
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
