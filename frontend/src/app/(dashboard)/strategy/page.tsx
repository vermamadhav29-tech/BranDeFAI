"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Quote,
  Calendar,
  RefreshCw,
  Zap,
  Film,
  ChevronRight,
  Music2,
  Clock,
  Layers,
  Play,
  ImageIcon,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Brand from "@/components/draftr/Brand";
import { useBrandStore } from "@/stores/brandStore";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import type { Brand as BrandType } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ContentPillar {
  name: string;
  description: string;
  examples: string[];
}

interface SceneBreakdown {
  sceneNumber: number;
  visualDescription: string;
  productInvolved: string;
  aiVideoPrompt: string;
  duration: 5;
  generatedImageUrl?: string;
  generatedClipUrl?: string;
}

interface VideoIdea {
  videoTitle: string;
  concept: string;
  estimatedDuration: "5s" | "10s" | "15s" | "30s+";
  numberOfScenes: number;
  scenes: SceneBreakdown[];
  suggestedAudioType: string;
}

interface StrategyData {
  contentPillars: ContentPillar[];
  hookFrameworks: string[];
  postingRhythm: string;
  monthDirectionSummary: string;
  contentMix: {
    educational: number;
    entertaining: number;
    promotional: number;
  };
  videoIdeas: VideoIdea[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  "Reviewing your industry trends…",
  "Building content pillars…",
  "Writing your hook frameworks…",
  "Crafting your month direction…",
  "Scripting 10 video reel ideas…",
  "Writing cinematic scene breakdowns…",
];

const DURATION_CHIP: Record<string, string> = { "5s": "g", "10s": "b", "15s": "p", "30s+": "a" };

const PILLAR_COLORS = [
  { bg: "var(--tint)", fg: "var(--p)" },
  { bg: "var(--blue-bg)", fg: "var(--blue)" },
  { bg: "var(--orange-bg)", fg: "var(--orange)" },
  { bg: "var(--green-bg)", fg: "var(--green)" },
  { bg: "var(--pink-bg)", fg: "var(--pink)" },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function LoadingState({ brandName }: { brandName: string }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bd-card bd-reveal" style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div style={{ display: "grid", justifyItems: "center", gap: 22, padding: "40px 12px" }}>
        <div className="bd-pulse"><Sparkles size={34} color="#fff" /></div>
        <div style={{ height: 30 }}><Brand size={22} /></div>
        <div>
          <h2 className="bd-card-title" style={{ fontSize: 24 }}>
            Your AI strategist is analyzing <span style={{ color: "var(--p)" }}>{brandName}</span>…
          </h2>
          <p key={msgIndex} className="bd-card-sub bd-reveal" style={{ marginTop: 10, fontSize: 15 }}>{LOADING_MESSAGES[msgIndex]}</p>
        </div>
        <div className="bd-progress" style={{ width: 260 }}><span style={{ width: `${((msgIndex + 1) / LOADING_MESSAGES.length) * 100}%` }} /></div>
        <p className="bd-hint">This usually takes under a minute.</p>
      </div>
    </div>
  );
}

function ContentMixBar({ educational, entertaining, promotional }: { educational: number; entertaining: number; promotional: number }) {
  const segments = [
    { label: "Educational", value: educational, color: "#5235ef" },
    { label: "Entertaining", value: entertaining, color: "#8771ff" },
    { label: "Promotional", value: promotional, color: "#101011" },
  ];

  return (
    <div>
      <div className="bd-mix" role="img" aria-label="Content mix">
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${s.value}%`, background: s.color }} />
        ))}
      </div>
      <div className="bd-legend">
        {segments.map((s) => (
          <div key={s.label}>
            <i style={{ background: s.color }} />
            {s.label} <b style={{ color: "var(--ink)" }}>{s.value}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scene generation state ────────────────────────────────────────────────────

interface SceneState {
  id: string;
  sceneNumber: number;
  description: string;
  status: "idle" | "generating" | "done" | "failed";
  imageUrl?: string;
  clipUrl?: string;
  error?: string;
}

type ProjectPhase = "idle" | "creating" | "generating" | "done";

// ─── VideoIdeaAccordion ────────────────────────────────────────────────────────

function VideoIdeaAccordion({ idea, ideaIndex }: { idea: VideoIdea; ideaIndex: number }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<ProjectPhase>("idle");
  const [scenes, setScenes] = useState<SceneState[]>([]);
  const [projectError, setProjectError] = useState("");

  const doneCount = scenes.filter((s) => s.status === "done").length;
  const failedCount = scenes.filter((s) => s.status === "failed").length;
  const allSettled = scenes.length > 0 && doneCount + failedCount === scenes.length;
  const currentlyGenerating = scenes.find((s) => s.status === "generating");

  function updateScene(id: string, patch: Partial<SceneState>) {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function handleGenerateScenes() {
    setProjectError("");
    setOpen(true);

    // ── Phase 1: create project + scene records ───────────────────────────────
    setPhase("creating");
    let sceneList: SceneState[];
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { projectId: string; scenes: Array<{ id: string; sceneNumber: number; description: string }> };
      }>("/api/strategy/create-project", { videoIdeaIndex: ideaIndex });

      sceneList = res.data.data.scenes.map((s) => ({
        ...s,
        status: "idle" as const,
      }));
      setScenes(sceneList);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setProjectError(e.response?.data?.error ?? e.message ?? "Failed to create project");
      setPhase("idle");
      return;
    }

    // ── Phase 2: generate each scene independently ────────────────────────────
    setPhase("generating");

    for (const scene of sceneList) {
      updateScene(scene.id, { status: "generating" });

      try {
        const res = await apiClient.post<{
          success: boolean;
          data: { imageUrl: string; clipUrl: string };
        }>("/api/strategy/generate-scene", { sceneId: scene.id }, { timeout: 420_000 });
        const { imageUrl, clipUrl } = res.data.data;
        updateScene(scene.id, { status: "done", imageUrl, clipUrl });
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        updateScene(scene.id, {
          status: "failed",
          error: e.response?.data?.error ?? e.message ?? "Generation failed",
        });
        // continue to next scene — failure is isolated
      }
    }

    setPhase("done");
  }

  async function handleRetryFailed() {
    if (phase === "generating") return;
    setPhase("generating");

    const failedScenes = scenes.filter((s) => s.status === "failed");
    for (const scene of failedScenes) {
      updateScene(scene.id, { status: "generating", error: undefined });

      try {
        const res = await apiClient.post<{
          success: boolean;
          data: { imageUrl: string; clipUrl: string };
        }>("/api/strategy/generate-scene", { sceneId: scene.id }, { timeout: 420_000 });
        const { imageUrl, clipUrl } = res.data.data;
        updateScene(scene.id, { status: "done", imageUrl, clipUrl });
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        updateScene(scene.id, {
          status: "failed",
          error: e.response?.data?.error ?? e.message ?? "Generation failed",
        });
      }
    }

    setPhase("done");
  }

  const isActive = phase === "creating" || phase === "generating";

  return (
    <div className={"bd-acc" + (open ? " is-open" : "")}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="chev"><ChevronRight size={16} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="ttl">{idea.videoTitle}</p>
          <div className="meta">
            <span className={"bd-chip " + (DURATION_CHIP[idea.estimatedDuration] ?? "")}>{idea.estimatedDuration}</span>
            <span className="bd-chip"><Layers size={11} /> {idea.numberOfScenes} scene{idea.numberOfScenes !== 1 ? "s" : ""}</span>
            <span className="bd-chip"><Music2 size={11} /> {idea.suggestedAudioType}</span>
            {doneCount > 0 && <span className="bd-chip g"><CheckCircle2 size={11} /> {doneCount}/{idea.scenes.length} generated</span>}
          </div>
          <p className="concept">{idea.concept}</p>
        </div>
      </button>

      {open && (
        <div className="bd-acc-body">
          {isActive && (
            <div style={{ paddingTop: 14 }}>
              <div className="bd-busy" style={{ margin: "0 0 8px" }}>
                <Loader2 size={15} className="bd-spin-icon" />
                {phase === "creating" ? "Creating project…" : currentlyGenerating ? `Generating scene ${currentlyGenerating.sceneNumber} of ${idea.scenes.length}…` : "Finalising…"}
                {phase === "generating" && <span className="bd-hint" style={{ marginLeft: "auto" }}>{doneCount} done · {failedCount} failed</span>}
              </div>
              {phase === "generating" && (
                <div className="bd-progress"><span style={{ width: `${scenes.length ? ((doneCount + failedCount) / scenes.length) * 100 : 0}%` }} /></div>
              )}
              <p className="bd-hint" style={{ marginTop: 8 }}>Each scene takes 2–3 min (image + Runway clip) · 3 credits per scene</p>
            </div>
          )}

          {scenes.length > 0 ? (
            <div className="bd-scenes">
              {scenes.map((scn) => (
                <div key={scn.id} className="bd-scene">
                  <div className="hd">
                    <span className="n">{scn.sceneNumber}</span>
                    <span className="bd-chip"><Clock size={11} /> 5s</span>
                    {scn.status === "generating" && <span className="bd-chip p"><Loader2 size={11} className="bd-spin-icon" /> Generating…</span>}
                    {scn.status === "done" && <span className="bd-chip g"><CheckCircle2 size={11} /> Done</span>}
                    {scn.status === "failed" && <span className="bd-chip r"><AlertCircle size={11} /> Failed</span>}
                  </div>
                  <p>{scn.description}</p>
                  {scn.error && <p className="bd-field-err">{scn.error}</p>}
                  {scn.status === "done" && scn.imageUrl && scn.clipUrl && (
                    <div className="bd-media">
                      <a href={scn.imageUrl} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={scn.imageUrl} alt={`Scene ${scn.sceneNumber} image`} />
                        <span><ImageIcon size={11} style={{ verticalAlign: -1 }} /> Image</span>
                      </a>
                      <a href={scn.clipUrl} target="_blank" rel="noreferrer">
                        <Play size={22} />
                        <span>Clip ↗</span>
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bd-scenes">
              {idea.scenes.map((scene) => (
                <div key={scene.sceneNumber} className="bd-scene">
                  <div className="hd">
                    <span className="n">{scene.sceneNumber}</span>
                    <span className="bd-chip"><Clock size={11} /> 5s</span>
                  </div>
                  <p>{scene.visualDescription}</p>
                  <p style={{ fontSize: 13, color: "var(--gray)" }}><b style={{ color: "var(--ink)" }}>Product:</b> {scene.productInvolved}</p>
                  <div className="bd-prompt">
                    <b>Runway prompt</b>
                    <p>{scene.aiVideoPrompt}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {projectError && <p className="bd-error" style={{ margin: 0 }}><AlertCircle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{projectError}</p>}

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {phase === "idle" && (
              <button type="button" className="bd-btn bd-btn-primary bd-btn-sm" onClick={handleGenerateScenes}>
                <Film size={14} /> Generate scenes <span style={{ opacity: 0.8 }}>· {idea.scenes.length * 3} credits</span>
              </button>
            )}
            {allSettled && failedCount > 0 && !isActive && (
              <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={handleRetryFailed}>
                <RefreshCw size={14} /> Retry {failedCount} failed scene{failedCount !== 1 ? "s" : ""}
              </button>
            )}
            {allSettled && doneCount === idea.scenes.length && (
              <p style={{ margin: 0, color: "#12744e", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle2 size={15} /> All {doneCount} scenes generated
              </p>
            )}
            {allSettled && failedCount > 0 && doneCount > 0 && <p className="bd-hint" style={{ margin: 0 }}>{doneCount} succeeded · {failedCount} failed</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, subtitle, delay, children }: { title: string; subtitle?: string; delay: number; children: React.ReactNode }) {
  return (
    <section className="bd-card bd-reveal" style={{ animationDelay: `${delay}s` }}>
      <div className="bd-card-head">
        <div>
          <h2 className="bd-card-title">{title}</h2>
          {subtitle && <p className="bd-card-sub">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const router = useRouter();
  const brand = useBrandStore((s) => s.brand);
  const setBrand = useBrandStore((s) => s.setBrand);

  const [resolvedBrand, setResolvedBrand] = useState<BrandType | null>(brand);
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [pageState, setPageState] = useState<"init" | "generating" | "result" | "error">("init");
  const [isApproving, setIsApproving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function init() {
      let activeBrand = resolvedBrand;

      if (!activeBrand) {
        try {
          const res = await apiClient.get<{ success: boolean; data: BrandType }>("/api/brand");
          if (res.data.success && res.data.data) {
            activeBrand = res.data.data;
            setResolvedBrand(activeBrand);
            setBrand(activeBrand);
          }
        } catch {
          setErrorMsg("Could not load brand. Please go back and complete brand setup.");
          setPageState("error");
          return;
        }
      }

      if (!activeBrand) {
        router.push("/brand-setup");
        return;
      }

      if (activeBrand.strategyApproved && activeBrand.strategyData) {
        setStrategy(activeBrand.strategyData as StrategyData);
        setPageState("result");
        return;
      }

      await runGenerate(activeBrand);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runGenerate(activeBrand?: BrandType) {
    const b = activeBrand ?? resolvedBrand;
    if (!b) return;

    setPageState("generating");
    setErrorMsg("");
    try {
      const res = await apiClient.post<{ success: boolean; data: StrategyData }>("/api/strategy/generate");
      if (res.data.success && res.data.data) {
        setStrategy(res.data.data);
        setPageState("result");
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setErrorMsg(e.response?.data?.error ?? e.message ?? "Generation failed");
      setPageState("error");
    }
  }

  async function handleApprove() {
    if (!strategy) return;
    setIsApproving(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: BrandType }>("/api/strategy/approve", strategy);
      if (res.data.success && res.data.data) {
        setBrand(res.data.data);
        setResolvedBrand(res.data.data);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error("Something went wrong", e.response?.data?.error ?? e.message ?? "Approval failed");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    await runGenerate();
    setIsRegenerating(false);
  }

  // ── Render states ────────────────────────────────────────────────────────────

  if (pageState === "init" || pageState === "generating") {
    return <LoadingState brandName={resolvedBrand?.brandName ?? "your brand"} />;
  }

  if (pageState === "error") {
    return (
      <div className="bd-card" style={{ maxWidth: 560 }}>
        <div className="bd-empty">
          <strong>We couldn&apos;t build your strategy</strong>
          {errorMsg}
          <div style={{ marginTop: 14 }}>
            <button type="button" className="bd-btn bd-btn-dark bd-btn-sm" onClick={() => runGenerate()}>
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!strategy) return null;

  const isApproved = resolvedBrand?.strategyApproved ?? false;
  const videoIdeas: VideoIdea[] = strategy.videoIdeas ?? [];

  return (
    <div className="bd-flow">
      <div className="bd-pagehead">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1>Your {resolvedBrand?.brandName} content strategy</h1>
            {isApproved && <span className="bd-chip g"><CheckCircle2 size={13} /> Approved</span>}
          </div>
          <p>AI-generated from your brand profile{!isApproved && " · approve it to unlock content generation"}.</p>
        </div>
      </div>

      <Section title="Content pillars" subtitle="The themes every post should belong to" delay={0.04}>
        <div className="bd-pillars">
          {strategy.contentPillars.map((pillar, i) => {
            const c = PILLAR_COLORS[i % PILLAR_COLORS.length];
            return (
              <div key={pillar.name} className="bd-pillar">
                <span className="no" style={{ background: c.bg, color: c.fg }}>{i + 1}</span>
                <h3>{pillar.name}</h3>
                <p>{pillar.description}</p>
                <div className="ex">
                  {pillar.examples.map((ex) => (
                    <span key={ex} className="bd-chip">{ex}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Hook frameworks" subtitle="How to open every post" delay={0.1}>
        <div className="bd-hooks">
          {strategy.hookFrameworks.map((hook, i) => (
            <div key={i} className="bd-hook">
              <Quote size={16} />
              <p>{hook}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="bd-grid-2">
        <Section title="Posting rhythm" delay={0.16}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span className="bd-stat-ico" style={{ background: "var(--blue-bg)", color: "var(--blue)", flexShrink: 0 }}><Calendar size={19} /></span>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--ink-2)" }}>{strategy.postingRhythm}</p>
          </div>
        </Section>
        <Section title="Content mix" delay={0.2}>
          <ContentMixBar {...strategy.contentMix} />
        </Section>
      </div>

      <section className="bd-direction bd-reveal" style={{ animationDelay: "0.24s" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, marginBottom: 10 }}>This month&apos;s direction</div>
        <p>{strategy.monthDirectionSummary}</p>
      </section>

      {videoIdeas.length > 0 && (
        <Section
          title="Video reel ideas"
          subtitle={`${videoIdeas.length} AI-scripted ideas with scene-by-scene breakdowns. Open one and generate its scenes.`}
          delay={0.3}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "5s", desc: "1 scene" },
                { label: "10s", desc: "1–2 scenes" },
                { label: "15s", desc: "3 scenes" },
                { label: "30s+", desc: "4–6 scenes" },
              ].map((item) => (
                <span key={item.label} className={"bd-chip " + (DURATION_CHIP[item.label] ?? "")}>
                  {item.label} · {item.desc}
                </span>
              ))}
            </div>
            {videoIdeas.map((idea, i) => (
              <VideoIdeaAccordion key={i} idea={idea} ideaIndex={i} />
            ))}
          </div>
        </Section>
      )}

      <div className="bd-actionbar">
        <div className="info">
          <Zap size={16} />
          {isApproved ? <span>Strategy locked in — credits already used</span> : <span>5 credits will be used on approval</span>}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="bd-btn bd-btn-ghost" disabled={isRegenerating || isApproving} onClick={handleRegenerate}>
            {isRegenerating ? <Loader2 size={16} className="bd-spin-icon" /> : <RefreshCw size={16} />}
            Regenerate{isApproved ? " (5 credits)" : ""}
          </button>
          {!isApproved && (
            <button type="button" className="bd-btn bd-btn-primary" disabled={isApproving || isRegenerating} onClick={handleApprove}>
              {isApproving ? (<><Loader2 size={16} className="bd-spin-icon" /> Approving…</>) : "Approve strategy & continue →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
