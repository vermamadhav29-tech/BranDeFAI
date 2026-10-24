"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Clock, Lock, Send, ShieldCheck, Sparkles } from "lucide-react";
import {
  IconBrandInstagram as Instagram,
  IconBrandYoutube,
  IconBrandX,
  IconBrandPinterest,
  IconBrandFacebook,
  IconBrandLinkedin,
  IconBrandTiktok,
  IconBrandThreads,
} from "@tabler/icons-react";
import { useBrandOptions } from "@/hooks/useActiveBrand";
import apiClient from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

interface QueueEntry {
  id: string;
  calendarDay: number;
  month: number;
  year: number;
  contentType: string;
  status: "SCHEDULED" | "PUBLISHED" | "SKIPPED";
  suggestedTime?: string | null;
  postedToInstagram?: boolean;
  preview?: unknown;
}

const TYPE_LABEL: Record<string, string> = { CAPTION: "Caption", REEL_IDEA: "Reel", AD_COPY: "Ad copy", IMAGE: "Image", VIDEO: "Video" };

function previewText(e: QueueEntry): string {
  const p = e.preview;
  if (typeof p === "string") return p;
  const o = (p ?? {}) as Record<string, unknown>;
  if (typeof o.hook === "string") return o.hook;
  if (typeof o.headline === "string") return o.headline;
  if (typeof o.imageUrl === "string") return "AI image";
  return TYPE_LABEL[e.contentType] ?? "Post";
}

const PLATFORMS: { name: string; blurb: string; icon: React.ElementType; bg: string }[] = [
  { name: "Instagram", blurb: "Posts, reels and stories", icon: Instagram, bg: "linear-gradient(135deg, #f58529, #dd2a7b 50%, #8134af)" },
  { name: "YouTube", blurb: "Shorts and long videos", icon: IconBrandYoutube, bg: "#ff0033" },
  { name: "X", blurb: "Posts and threads", icon: IconBrandX, bg: "#101011" },
  { name: "Pinterest", blurb: "Pins and boards", icon: IconBrandPinterest, bg: "#e60023" },
  { name: "Facebook", blurb: "Page posts", icon: IconBrandFacebook, bg: "#1877f2" },
  { name: "LinkedIn", blurb: "Company page updates", icon: IconBrandLinkedin, bg: "#0a66c2" },
  { name: "TikTok", blurb: "Short videos", icon: IconBrandTiktok, bg: "#101011" },
  { name: "Threads", blurb: "Text posts", icon: IconBrandThreads, bg: "#101011" },
];

const STEPS = [
  { icon: Instagram, title: "Connect your accounts", text: "Link each profile through the platform's official login. We never see your password." },
  { icon: CalendarDays, title: "Plan your month", text: "Generate a 30-day calendar and approve the posts you like. Each post gets a suggested time." },
  { icon: Send, title: "We publish for you", text: "Approved posts go live on schedule through each platform's official API. You can pause or disconnect any time." },
];

export default function SocialAccountsPage() {
  const { active } = useBrandOptions();
  const plan = useAuthStore((s) => s.user?.plan ?? "FREE");
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const now = new Date();
    apiClient
      .get<{ success: boolean; data: { entries: QueueEntry[] } }>(`/api/calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .then((r) => {
        if (r.data.success) {
          const today = now.getDate();
          setQueue((r.data.data.entries ?? []).filter((e) => e.status === "SCHEDULED" && e.calendarDay >= today).slice(0, 6));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const eligible = plan === "PRO" || plan === "BUSINESS";

  return (
    <div className="bd-flow">
      <div className="bd-pagehead">
        <div>
          <h1>Social accounts</h1>
          <p>Connect the profiles {active ? <>for <b>{active.name}</b> </> : null}and let BrandefAI publish your calendar automatically.</p>
        </div>
      </div>

      {/* platforms */}
      <div className="bd-platforms">
        {PLATFORMS.map((pl, i) => (
          <div key={pl.name} className="bd-card bd-reveal bd-platform" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="bd-platform-ico" style={{ background: pl.bg }}><pl.icon size={26} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3>{pl.name}</h3>
              <p>{pl.blurb}</p>
            </div>
            <span className="bd-chip">Not connected</span>
            <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" disabled title="Connections are launching soon">
              {eligible ? "Coming soon" : "Pro plan"}
            </button>
          </div>
        ))}
      </div>
      {!eligible && (
        <div className="bd-alert" style={{ background: "var(--tint)", color: "var(--p)" }}>
          <Lock size={18} />
          <span><strong>Auto-posting is included with Pro and Business.</strong> Connect every platform and publish on schedule.</span>
          <Link href="/credits" className="bd-link">View plans</Link>
        </div>
      )}

      {/* how it works */}
      <div className="bd-grid-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="bd-card bd-reveal" style={{ animationDelay: `${i * 70}ms` }}>
            <span className="bd-stat-ico" style={{ background: "var(--tint)", color: "var(--p)" }}><s.icon size={20} /></span>
            <h3 style={{ margin: "16px 0 6px", fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {i + 1}. {s.title}
            </h3>
            <p className="bd-card-sub" style={{ margin: 0 }}>{s.text}</p>
          </div>
        ))}
      </div>

      <div className="bd-split">
        {/* queue */}
        <div className="bd-card bd-reveal">
          <div className="bd-card-head">
            <div>
              <h2 className="bd-card-title">Publishing queue</h2>
              <p className="bd-card-sub">Scheduled posts that will go out once your account is connected.</p>
            </div>
            <Link href="/calendar" className="bd-link">Open calendar</Link>
          </div>
          {!loaded ? (
            <div style={{ display: "grid", gap: 10 }}>{[0, 1, 2].map((i) => <div key={i} className="bd-skel" style={{ height: 56, borderRadius: 16 }} />)}</div>
          ) : queue.length === 0 ? (
            <div className="bd-empty">
              <strong>Nothing scheduled yet</strong>
              <Link href="/calendar" className="bd-link" style={{ display: "inline-flex" }}>Plan your month →</Link>
            </div>
          ) : (
            <div className="bd-list">
              {queue.map((e) => (
                <Link key={e.id} href="/calendar" className="bd-row">
                  <span className="ico" style={{ background: "var(--tint)", color: "var(--p)" }}><Clock size={17} /></span>
                  <span className="main">
                    <b>{previewText(e)}</b>
                    <span>
                      {TYPE_LABEL[e.contentType] ?? "Post"} · {new Date(e.year, e.month - 1, e.calendarDay).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {e.suggestedTime ? ` · ${e.suggestedTime}` : ""}
                    </span>
                  </span>
                  <span className="bd-chip">Queued</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* safety */}
        <div className="bd-flow">
          <div className="bd-card bd-reveal">
            <h2 className="bd-card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ShieldCheck size={20} style={{ color: "var(--green)" }} /> Safe by design
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 12, fontSize: 14, color: "var(--ink-2)" }}>
              {["Official Meta login. We never see your password.", "Only posts you approved are ever published.", "Disconnect with one click from this page."].map((t) => (
                <li key={t} style={{ display: "flex", gap: 10 }}>
                  <Check size={17} style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="bd-card bd-reveal" style={{ background: "var(--ink)", color: "#fff", border: 0 }}>
            <div className="bd-tip" style={{ color: "#c9c9cc" }}>
              <Sparkles size={19} style={{ color: "#ffd166", flexShrink: 0, marginTop: 2 }} />
              <div>
                <b style={{ color: "#fff", display: "block", fontSize: 15, marginBottom: 4 }}>Works with Business &amp; Creator accounts</b>
                Your Instagram account needs to be a Business or Creator account linked to a Facebook Page.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
