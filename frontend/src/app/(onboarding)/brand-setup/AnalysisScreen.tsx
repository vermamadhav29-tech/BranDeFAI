"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

// Placeholder for the brand analysis. Each source "loads" in turn and shows what was found as
// plain text. The numbers and wording are generated locally from the URL until the AI agent
// that reads the real pages is connected.

interface Source {
  key: "instagram" | "website" | "google";
  title: string;
  fetching: string;
  url: string;
  rows: [string, string][];
}

function hash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function compact(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n);
}

function host(url: string): string {
  try {
    return new URL(/^https?:\/\//.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function instagramHandle(url: string): string {
  const m = url.match(/instagram\.com\/([^/?#]+)/i);
  return (m?.[1] ?? host(url).split(".")[0]).replace(/^@/, "");
}

function buildSources(brand: string, industry: string, urls: { instagram: string; website: string; google: string }): Source[] {
  const out: Source[] = [];
  const ind = industry.toLowerCase();
  if (urls.instagram) {
    const h = hash(urls.instagram);
    const handle = instagramHandle(urls.instagram);
    out.push({
      key: "instagram",
      title: "Instagram",
      fetching: "Fetching Instagram profile…",
      url: urls.instagram,
      rows: [
        ["Handle", "@" + handle],
        ["Bio", `${brand} · ${industry} made with care. Shop the latest drop ↓`],
        ["Followers", compact(1200 + (h % 48000))],
        ["Following", String(80 + (h % 400))],
        ["Posts", String(40 + (h % 600))],
        ["Posting rhythm", `About ${3 + (h % 4)} posts a week, mostly photos and reels`],
        ["Recent captions", `Short, friendly captions about ${ind}, with 3–5 hashtags and a clear call to action`],
      ],
    });
  }
  if (urls.website) {
    const h = hash(urls.website);
    out.push({
      key: "website",
      title: "Website",
      fetching: "Reading your website…",
      url: urls.website,
      rows: [
        ["Domain", host(urls.website)],
        ["Title", `${brand} | ${industry}`],
        ["Description", `${brand} offers ${ind} for customers who value quality and a personal touch.`],
        ["Main pages", "Home, Shop, About, Contact"],
        ["Products and services", `${ind.charAt(0).toUpperCase() + ind.slice(1)} · ${3 + (h % 6)} categories found`],
        ["Voice on the page", "Warm and direct, short sentences"],
      ],
    });
  }
  if (urls.google) {
    const h = hash(urls.google);
    out.push({
      key: "google",
      title: "Google Business Profile",
      fetching: "Looking up your Google Business Profile…",
      url: urls.google,
      rows: [
        ["Business name", brand],
        ["Category", industry],
        ["Rating", `${(4 + (h % 10) / 10).toFixed(1)} out of 5`],
        ["Reviews", String(12 + (h % 340))],
        ["Address", "Shown here once your profile is analysed"],
        ["Phone", "Shown here once your profile is analysed"],
        ["Opening hours", "Mon–Sat, 10:00 – 20:00"],
        ["What reviewers mention", "Quality, friendly service, value for money"],
      ],
    });
  }
  return out;
}

const STEP_MS = 1700;

export default function AnalysisScreen({
  brandName,
  industry,
  instagramUrl,
  websiteUrl,
  googleBusinessUrl,
  audience,
  brief,
  submitting,
  error,
  onBack,
  onContinue,
}: {
  brandName: string;
  industry: string;
  instagramUrl: string;
  websiteUrl: string;
  googleBusinessUrl: string;
  audience: string;
  brief: string;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  const sources = useMemo(
    () => buildSources(brandName || "Your brand", industry || "brand", { instagram: instagramUrl, website: websiteUrl, google: googleBusinessUrl }),
    [brandName, industry, instagramUrl, websiteUrl, googleBusinessUrl],
  );
  // how many sources have finished loading
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done >= sources.length) return;
    const t = setTimeout(() => setDone((d) => d + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [done, sources.length]);

  const finished = done >= sources.length;
  const skipped = [
    !instagramUrl && "Instagram",
    !websiteUrl && "Website",
    !googleBusinessUrl && "Google Business Profile",
  ].filter(Boolean) as string[];

  return (
    <div>
      <button type="button" className="bd-back" onClick={onBack} disabled={submitting}>← Back</button>
      <h1>{finished ? "Here's what we found" : "Analysing your brand"}</h1>
      <p className="lead">
        {sources.length
          ? "We read each page you shared and note what matters for your content."
          : "You didn't add any links, so we'll build your profile from your answers."}
      </p>
      <p className="bd-an-note">Preview: the details below are sample data. Live analysis is coming soon.</p>

      <div className="bd-an-list">
        {sources.map((s, i) => {
          const state = i < done ? "done" : i === done ? "loading" : "wait";
          return (
            <section key={s.key} className={"bd-an-card is-" + state}>
              <header>
                <span className="bd-an-dot">
                  {state === "done" ? <Check size={14} strokeWidth={3} /> : state === "loading" ? <Loader2 size={14} className="bd-spin-icon" /> : null}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b>{state === "loading" ? s.fetching : s.title}</b>
                  <span className="bd-an-url">{s.url}</span>
                </div>
              </header>
              {state === "done" && (
                <dl>
                  {s.rows.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {state === "wait" && <p className="bd-an-wait">Waiting…</p>}
            </section>
          );
        })}
        {skipped.length > 0 && sources.length > 0 && (
          <p className="bd-hint" style={{ margin: 0 }}>Skipped, no link added: {skipped.join(", ")}.</p>
        )}
      </div>

      {finished && (
        <section className="bd-an-card is-done bd-reveal" style={{ marginTop: 14 }}>
          <header>
            <span className="bd-an-dot"><Check size={14} strokeWidth={3} /></span>
            <div><b>What you told us</b></div>
          </header>
          <dl>
            <div>
              <dt>Who are you trying to reach?</dt>
              <dd>{audience || "Not answered"}</dd>
            </div>
            <div>
              <dt>Brand brief</dt>
              <dd>{brief || "Not answered"}</dd>
            </div>
          </dl>
        </section>
      )}

      {error && <p className="bd-error">{error}</p>}

      <div className="bd-wiz-actions">
        <button type="button" className="bd-btn bd-btn-primary" disabled={!finished || submitting} onClick={onContinue}>
          {submitting && <Loader2 size={17} className="bd-spin-icon" />}
          Looks good, continue
        </button>
      </div>
    </div>
  );
}
