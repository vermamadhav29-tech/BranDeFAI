"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  Quote,
  Calendar,
  RefreshCw,
  Zap,
  Film,
  ChevronDown,
  ChevronRight,
  Music2,
  Clock,
  Layers,
  Play,
  ImageIcon,
  AlertCircle,
} from "lucide-react";
import { useBrandStore } from "@/stores/brandStore";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import type { Brand } from "@/types";

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

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const LOADING_MESSAGES = [
  "Reviewing your industry trends…",
  "Building content pillars…",
  "Writing your hook frameworks…",
  "Crafting your month direction…",
  "Scripting 10 video reel ideas…",
  "Writing cinematic scene breakdowns…",
];

const DURATION_COLORS: Record<string, string> = {
  "5s": "bg-emerald-50 text-emerald-700",
  "10s": "bg-blue-50 text-blue-700",
  "15s": "bg-purple-50 text-purple-700",
  "30s+": "bg-amber-50 text-amber-700",
};

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="text-2xl font-bold text-[#1A2E44]">
        BranDe<span className="text-[#1A7A4A]">FAI</span>
      </div>
      <div className="relative w-14 h-14 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.55, 1], opacity: [0.35, 0.08, 0.35] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-[#1A7A4A]"
        />
        <div className="w-5 h-5 rounded-full bg-[#1A7A4A]" />
      </div>
      <div>
        <p className="text-base font-semibold text-[#1A2E44]">
          Your AI strategist is analyzing{" "}
          <span className="text-[#1A7A4A]">{brandName}</span>…
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="text-sm text-gray-400 mt-2"
          >
            {LOADING_MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ContentMixBar({
  educational,
  entertaining,
  promotional,
}: {
  educational: number;
  entertaining: number;
  promotional: number;
}) {
  const segments = [
    { label: "Educational", value: educational, color: "#1A7A4A" },
    { label: "Entertaining", value: entertaining, color: "#34D399" },
    { label: "Promotional", value: promotional, color: "#1A2E44" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {segments.map((s) => (
          <motion.div
            key={s.label}
            initial={{ width: 0 }}
            animate={{ width: `${s.value}%` }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.3 }}
            style={{ backgroundColor: s.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            {s.label} {s.value}%
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

function VideoIdeaAccordion({
  idea,
  ideaIndex,
}: {
  idea: VideoIdea;
  ideaIndex: number;
}) {
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
        }>(
          "/api/strategy/generate-scene",
          { sceneId: scene.id },
          { timeout: 420_000 }
        );
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
        }>(
          "/api/strategy/generate-scene",
          { sceneId: scene.id },
          { timeout: 420_000 }
        );
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="mt-0.5 text-[#1A7A4A]">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold text-sm text-[#1A2E44] leading-snug">
              {idea.videoTitle}
            </p>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                DURATION_COLORS[idea.estimatedDuration] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {idea.estimatedDuration}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0 flex items-center gap-1">
              <Layers size={10} />
              {idea.numberOfScenes} scene{idea.numberOfScenes !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0 flex items-center gap-1">
              <Music2 size={10} />
              {idea.suggestedAudioType}
            </span>
            {doneCount > 0 && (
              <span className="text-[10px] font-semibold text-[#1A7A4A] bg-[#E8F5EE] px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                <CheckCircle2 size={10} />
                {doneCount}/{idea.scenes.length} generated
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 leading-snug line-clamp-2">{idea.concept}</p>
        </div>
      </button>

      {/* Accordion body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-gray-50">

              {/* ── Progress bar (visible while generating) ─────────────────── */}
              {(phase === "creating" || phase === "generating") && (
                <div className="mt-4 bg-[#E8F5EE] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 size={13} className="text-[#1A7A4A] animate-spin shrink-0" />
                    <p className="text-xs font-semibold text-[#1A2E44]">
                      {phase === "creating"
                        ? "Creating project…"
                        : currentlyGenerating
                        ? `Generating Scene ${currentlyGenerating.sceneNumber} of ${idea.scenes.length}…`
                        : "Finalising…"}
                    </p>
                    {phase === "generating" && (
                      <span className="ml-auto text-[10px] text-gray-500">
                        {doneCount} done · {failedCount} failed
                      </span>
                    )}
                  </div>

                  {phase === "generating" && (
                    <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[#1A7A4A] rounded-full"
                        animate={{
                          width: `${((doneCount + failedCount) / idea.scenes.length) * 100}%`,
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  )}

                  <p className="text-[10px] text-gray-500 mt-2">
                    Each scene takes 2–3 min (image + RunwayML clip) · 3 credits per scene
                  </p>
                </div>
              )}

              {/* ── Scene cards (shown once project is created) ──────────────── */}
              {scenes.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {scenes.map((scn) => (
                    <div
                      key={scn.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        scn.status === "done"
                          ? "border-[#1A7A4A]/20 bg-[#E8F5EE]/30"
                          : scn.status === "failed"
                          ? "border-red-100 bg-red-50/40"
                          : scn.status === "generating"
                          ? "border-[#1A7A4A]/30 bg-white"
                          : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      {/* Scene header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-white bg-[#1A2E44] rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                          {scn.sceneNumber}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock size={9} /> 5s
                        </span>

                        {scn.status === "generating" && (
                          <span className="flex items-center gap-1 text-[10px] text-[#1A7A4A] font-medium">
                            <Loader2 size={9} className="animate-spin" />
                            Generating image + clip…
                          </span>
                        )}
                        {scn.status === "done" && (
                          <span className="flex items-center gap-1 text-[10px] text-[#1A7A4A] font-semibold">
                            <CheckCircle2 size={9} /> Done
                          </span>
                        )}
                        {scn.status === "failed" && (
                          <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                            <AlertCircle size={9} /> Failed
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-medium text-[#1A2E44] mb-1">{scn.description}</p>

                      {scn.error && (
                        <p className="text-[10px] text-red-500 mt-1">{scn.error}</p>
                      )}

                      {/* Generated media */}
                      {scn.status === "done" && scn.imageUrl && scn.clipUrl && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <a
                            href={scn.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/5]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={scn.imageUrl}
                              alt={`Scene ${scn.sceneNumber} image`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImageIcon size={14} className="text-white" />
                            </div>
                            <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/80 font-medium">
                              Scene Image
                            </span>
                          </a>
                          <a
                            href={scn.clipUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative rounded-xl overflow-hidden bg-gray-900 aspect-[4/5] flex items-center justify-center"
                          >
                            <Play size={20} className="text-white opacity-70 group-hover:opacity-100 transition-opacity" />
                            <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/70">
                              Video Clip ↗
                            </span>
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Show strategy scene breakdown before project is created */
                <div className="mt-4 space-y-3">
                  {idea.scenes.map((scene) => (
                    <div key={scene.sceneNumber} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-white bg-[#1A2E44] rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                          {scene.sceneNumber}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock size={9} /> 5s
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#1A2E44] mb-1">
                        {scene.visualDescription}
                      </p>
                      <p className="text-[11px] text-gray-500 mb-2">
                        <span className="font-medium text-gray-600">Product:</span>{" "}
                        {scene.productInvolved}
                      </p>
                      <div className="bg-white border border-gray-100 rounded-lg p-3">
                        <p className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wide">
                          RunwayML Prompt
                        </p>
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                          {scene.aiVideoPrompt}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Project error */}
              {projectError && (
                <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-xl p-3">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {projectError}
                </div>
              )}

              {/* ── Action buttons ────────────────────────────────────────────── */}
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                {/* Generate Scenes — shown when idle (no project created yet) */}
                {phase === "idle" && (
                  <button
                    type="button"
                    onClick={handleGenerateScenes}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1A2E44] hover:bg-[#1A2E44]/90 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    <Film size={13} />
                    Generate Scenes
                    <span className="text-[10px] text-white/60">
                      · {idea.scenes.length * 3} credits
                    </span>
                  </button>
                )}

                {/* Retry Failed — shown after all scenes settle and some failed */}
                {allSettled && failedCount > 0 && !isActive && (
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    <RefreshCw size={13} />
                    Retry {failedCount} Failed Scene{failedCount !== 1 ? "s" : ""}
                  </button>
                )}

                {/* Summary when all done */}
                {allSettled && doneCount === idea.scenes.length && (
                  <p className="text-[11px] text-[#1A7A4A] font-medium flex items-center gap-1.5">
                    <CheckCircle2 size={12} />
                    All {doneCount} scenes generated
                  </p>
                )}
                {allSettled && failedCount > 0 && doneCount > 0 && (
                  <p className="text-[10px] text-gray-400">
                    {doneCount} succeeded · {failedCount} failed
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const router = useRouter();
  const brand = useBrandStore((s) => s.brand);
  const setBrand = useBrandStore((s) => s.setBrand);

  const [resolvedBrand, setResolvedBrand] = useState<Brand | null>(brand);
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
          const res = await apiClient.get<{ success: boolean; data: Brand }>("/api/brand");
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

  async function runGenerate(activeBrand?: Brand) {
    const b = activeBrand ?? resolvedBrand;
    if (!b) return;

    setPageState("generating");
    setErrorMsg("");
    try {
      const res = await apiClient.post<{ success: boolean; data: StrategyData }>(
        "/api/strategy/generate"
      );
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
      const res = await apiClient.post<{ success: boolean; data: Brand }>(
        "/api/strategy/approve",
        strategy
      );
      if (res.data.success && res.data.data) {
        setBrand(res.data.data);
        setResolvedBrand(res.data.data);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(
        "Something went wrong",
        e.response?.data?.error ?? e.message ?? "Approval failed"
      );
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <p className="text-sm text-red-500 max-w-sm">{errorMsg}</p>
        <button
          type="button"
          onClick={() => runGenerate()}
          className="px-6 py-2.5 bg-[#1A7A4A] text-white rounded-xl text-sm font-semibold hover:bg-[#145C38] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!strategy) return null;

  const isApproved = resolvedBrand?.strategyApproved ?? false;
  const videoIdeas: VideoIdea[] = strategy.videoIdeas ?? [];

  return (
    <div className="pb-32">
      <div className="max-w-[860px] mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[#1A2E44]">
              Your {resolvedBrand?.brandName} Content Strategy
            </h1>
            {isApproved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A7A4A] bg-[#E8F5EE] px-2.5 py-1 rounded-full shrink-0">
                <CheckCircle2 size={13} />
                Strategy Approved
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">
            AI-generated based on your brand profile
            {!isApproved && " · Approve to begin generating"}
          </p>
        </motion.div>

        {/* ── Section 1: Content Pillars ────────────────────────────────── */}
        <Section title="Content Pillars" delay={0.05}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {strategy.contentPillars.map((pillar, i) => (
              <motion.div
                key={pillar.name}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.12 + i * 0.07, ease: EASE_OUT }}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
              >
                <p className="font-bold text-[#1A7A4A] text-sm mb-1.5">{pillar.name}</p>
                <p className="text-sm text-gray-500 leading-snug mb-3">{pillar.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {pillar.examples.map((ex) => (
                    <span
                      key={ex}
                      className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ── Section 2: Hook Frameworks ───────────────────────────────── */}
        <Section title="Hook Frameworks" subtitle="How to open every post" delay={0.2}>
          <div className="space-y-3">
            {strategy.hookFrameworks.map((hook, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.25 + i * 0.06, ease: EASE_OUT }}
                className="flex gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3.5 shadow-sm border-l-4 border-l-[#1A7A4A]"
              >
                <Quote size={14} className="text-[#1A7A4A] shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600 leading-snug">{hook}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ── Section 3: Posting Rhythm + Content Mix ──────────────────── */}
        <Section title="Schedule & Mix" delay={0.35}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.4, ease: EASE_OUT }}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-[#E8F5EE] flex items-center justify-center shrink-0">
                  <Calendar size={15} className="text-[#1A7A4A]" />
                </div>
                <p className="text-sm font-semibold text-[#1A2E44]">Posting Rhythm</p>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{strategy.postingRhythm}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.47, ease: EASE_OUT }}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
            >
              <p className="text-sm font-semibold text-[#1A2E44] mb-3">Content Mix</p>
              <ContentMixBar {...strategy.contentMix} />
            </motion.div>
          </div>
        </Section>

        {/* ── Section 4: Month Direction ───────────────────────────────── */}
        <Section title="This Month's Direction" delay={0.5}>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.55, ease: EASE_OUT }}
            className="bg-[#E8F5EE] rounded-2xl px-6 py-5"
          >
            <p className="text-sm text-[#1A2E44] italic leading-relaxed">
              {strategy.monthDirectionSummary}
            </p>
          </motion.div>
        </Section>

        {/* ── Section 5: Video Reel Ideas ──────────────────────────────── */}
        {videoIdeas.length > 0 && (
          <Section
            title="Video Reel Ideas"
            subtitle={`${videoIdeas.length} AI-scripted ideas with scene-by-scene breakdowns · Click to expand · Generate Scenes to produce image + clip per scene`}
            delay={0.6}
          >
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.65, ease: EASE_OUT }}
              className="space-y-3"
            >
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-1">
                {[
                  { label: "5s", desc: "1 scene" },
                  { label: "10s", desc: "1–2 scenes" },
                  { label: "15s", desc: "3 scenes" },
                  { label: "30s+", desc: "4–6 scenes" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        DURATION_COLORS[item.label] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.desc}
                  </div>
                ))}
              </div>

              {videoIdeas.map((idea, i) => (
                <VideoIdeaAccordion key={i} idea={idea} ideaIndex={i} />
              ))}
            </motion.div>
          </Section>
        )}
      </div>

      {/* ── Sticky bottom bar ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-60 right-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5 text-sm text-gray-400">
          <Zap size={14} className="text-amber-400" />
          {isApproved ? (
            <span>Strategy locked in — credits already used</span>
          ) : (
            <span>5 credits will be used on approval</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isRegenerating || isApproving}
            onClick={handleRegenerate}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Regenerate{isApproved ? " (5 credits)" : ""}
          </button>

          {!isApproved && (
            <button
              type="button"
              disabled={isApproving || isRegenerating}
              onClick={handleApprove}
              className="flex items-center gap-2 bg-[#1A7A4A] hover:bg-[#145C38] text-white font-semibold rounded-xl px-6 py-2.5 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isApproving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Approving…
                </>
              ) : (
                "Approve Strategy & Continue →"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  delay,
  children,
}: {
  title: string;
  subtitle?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay, ease: EASE_OUT }}
      className="mb-8"
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-[#1A2E44]">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}
