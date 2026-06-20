"use client";

import {
  useState,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Upload,
  Sparkles,
  Play,
  Pause,
  X,
  GripVertical,
  Download,
  Loader2,
  Film,
  Clock,
  Check,
  Undo2,
  Video,
  Image as ImageIcon,
  Maximize,
  Minimize,
  Folder,
  Layers,
  Zap,
  RefreshCw,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useVideoStore, type TimelineClip, type TransitionType } from "@/stores/videoStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  title: string;
  status: string;
  exportUrl: string | null;
  createdAt: string;
}

interface LibraryClip {
  id: string;
  url: string;
  title: string;
  duration: number;
  thumbnailDataUrl: string | null;
  source: "uploaded" | "ai";
}

interface StrategySceneItem {
  id: string;
  sceneNumber: number;
  imageUrl: string | null;
  clipUrl: string | null;
  duration: number;
}

interface StrategyProject {
  id: string;
  title: string;
  strategyIdeaIndex: number;
  status: string;
  exportUrl: string | null;
  scenes: StrategySceneItem[];
}

type AiTransitionType =
  | "crossfade"
  | "hard_cut"
  | "fade_to_black"
  | "slide_left"
  | "zoom_out";

interface TransitionSuggestion {
  between: string;
  transition: AiTransitionType;
  duration_ms: number;
}

type CompilePhase =
  | "idle"
  | "suggesting"
  | "reviewing"
  | "compiling"
  | "done"
  | "failed";

interface ProjectCompileState {
  phase: CompilePhase;
  suggestions: TransitionSuggestion[];
  overrides: Record<string, TransitionSuggestion>;
  compiledUrl: string | null;
  error: string | null;
}

interface RefinementResult {
  updatedClips: { id: string; transitionType: TransitionType }[];
  summary: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PX_PER_SECOND = 40;
const AUTOSAVE_DELAY = 30_000;
const POLL_INTERVAL = 5_000;

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: "none", label: "Cut" },
  { value: "crossfade", label: "Cross-Dissolve" },
  { value: "wipe-left", label: "Wipe Left" },
  { value: "wipe-right", label: "Wipe Right" },
];

const AI_TRANSITION_OPTIONS: { value: AiTransitionType; label: string; icon: string }[] = [
  { value: "crossfade", label: "Crossfade", icon: "⟷" },
  { value: "hard_cut", label: "Hard Cut", icon: "✂" },
  { value: "fade_to_black", label: "Fade to Black", icon: "⬛" },
  { value: "slide_left", label: "Slide Left", icon: "←" },
  { value: "zoom_out", label: "Zoom Out", icon: "⊖" },
];

const TRANSITION_COLORS: Record<AiTransitionType, string> = {
  crossfade: "bg-[#E8F5EE] text-[#1A7A4A] border-[#1A7A4A]/40",
  hard_cut: "bg-gray-100 text-gray-700 border-gray-300",
  fade_to_black: "bg-gray-900/10 text-gray-800 border-gray-500",
  slide_left: "bg-blue-50 text-blue-700 border-blue-300",
  zoom_out: "bg-purple-50 text-purple-700 border-purple-300",
};

const DEFAULT_COMPILE_STATE: ProjectCompileState = {
  phase: "idle",
  suggestions: [],
  overrides: {},
  compiledUrl: null,
  error: null,
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function uid(): string {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

async function extractThumbnail(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    const timer = setTimeout(() => { video.src = ""; resolve(null); }, 8000);
    video.onloadeddata = () => { video.currentTime = 0.5; };
    video.onseeked = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 160; canvas.height = 90;
        canvas.getContext("2d")?.drawImage(video, 0, 0, 160, 90);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch { resolve(null); }
    };
    video.onerror = () => { clearTimeout(timer); resolve(null); };
    video.src = url;
  });
}

async function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Math.round(v.duration) || 4);
    v.onerror = () => resolve(4);
    v.src = url;
  });
}


// ─── TransitionDot (timeline) ─────────────────────────────────────────────────

function TransitionDot({
  clipId,
  transitionType,
  onSelect,
}: {
  clipId: string;
  transitionType: TransitionType;
  onSelect: (clipId: string, t: TransitionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dotColor =
    transitionType === "crossfade" ? "bg-[#1A7A4A]" :
    transitionType !== "none" ? "bg-blue-400" : "bg-gray-300";

  return (
    <div ref={ref} className="relative flex-shrink-0 flex items-center justify-center w-6">
      <button
        type="button"
        title="Set transition"
        onClick={() => setOpen((v) => !v)}
        className={cn("w-3 h-3 rounded-full border-2 border-white transition-transform hover:scale-125 cursor-pointer shadow-sm", dotColor)}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 w-44 z-30"
          >
            <p className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Transition</p>
            {TRANSITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onSelect(clipId, opt.value); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2",
                  transitionType === opt.value
                    ? "text-[#1A7A4A] bg-[#E8F5EE]"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                {transitionType === opt.value && <Check size={10} className="text-[#1A7A4A]" />}
                <span className={transitionType === opt.value ? "" : "ml-[14px]"}>{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TransitionInlineEditor ───────────────────────────────────────────────────
// Inline expand between scene cards in the Projects folder.
// Shows the AI-suggested transition with an override dropdown.

function TransitionInlineEditor({
  suggestion,
  disabled,
  onOverride,
}: {
  suggestion: TransitionSuggestion;
  disabled: boolean;
  onOverride: (s: TransitionSuggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const colorClass = TRANSITION_COLORS[suggestion.transition];
  const meta = AI_TRANSITION_OPTIONS.find((o) => o.value === suggestion.transition);

  return (
    <div className="w-full">
      {/* Connector line + badge */}
      <div className="flex items-center gap-1.5 w-full py-1">
        <div className="flex-1 h-px bg-gray-200" />
        {disabled ? (
          <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-semibold border flex items-center gap-1 select-none", colorClass)}>
            <span>{meta?.icon}</span>
            {meta?.label}
            {suggestion.transition !== "hard_cut" && <span className="opacity-70">· {suggestion.duration_ms}ms</span>}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-semibold border flex items-center gap-1 transition-all hover:shadow-sm",
              colorClass
            )}
          >
            <span>{meta?.icon}</span>
            {meta?.label}
            {suggestion.transition !== "hard_cut" && <span className="opacity-70">· {suggestion.duration_ms}ms</span>}
            <ChevronDown
              size={8}
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
        )}
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Inline override panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 rounded-xl p-2.5 mb-1 border border-gray-100 space-y-2">
              {/* Type pills */}
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Type</p>
                <div className="flex flex-wrap gap-1">
                  {AI_TRANSITION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onOverride({ ...suggestion, transition: opt.value });
                        setOpen(false);
                      }}
                      className={cn(
                        "px-2 py-1 rounded-lg text-[9px] font-semibold border transition-colors flex items-center gap-1",
                        suggestion.transition === opt.value
                          ? TRANSITION_COLORS[opt.value]
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <span>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration pills (hidden for hard_cut) */}
              {suggestion.transition !== "hard_cut" && (
                <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Duration</p>
                  <div className="flex gap-1">
                    {[300, 500, 700].map((ms) => (
                      <button
                        key={ms}
                        type="button"
                        onClick={() => {
                          onOverride({ ...suggestion, duration_ms: ms });
                          setOpen(false);
                        }}
                        className={cn(
                          "flex-1 py-1 rounded-lg text-[9px] font-semibold border transition-colors",
                          suggestion.duration_ms === ms
                            ? "bg-[#1A2E44] text-white border-[#1A2E44]"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        )}
                      >
                        {ms}ms
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SortableClipBlock ────────────────────────────────────────────────────────

function SortableClipBlock({
  clip,
  isSelected,
  onClick,
  onRemove,
  onResize,
  onTransition,
  isLast,
}: {
  clip: TimelineClip;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
  onResize: (clipId: string, duration: number) => void;
  onTransition: (clipId: string, t: TransitionType) => void;
  isLast: boolean;
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${Math.max(80, Math.round(clip.duration * PX_PER_SECOND))}px`,
    opacity: isDragging ? 0.5 : 1,
  };

  const resizeRef = useRef<{ startX: number; startDuration: number } | null>(null);

  function handleResizeDown(e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startDuration: clip.duration };
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const delta = (ev.clientX - resizeRef.current.startX) / PX_PER_SECOND;
      onResize(clip.id, Math.max(1, Math.min(60, resizeRef.current.startDuration + delta)));
    }
    function onUp() {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="flex items-end flex-shrink-0">
      <div
        ref={setNodeRef}
        style={style}
        onClick={onClick}
        className={cn(
          "group relative h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors flex-shrink-0",
          isSelected ? "border-[#1A7A4A]" : "border-transparent hover:border-gray-400"
        )}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: clip.thumbnailDataUrl
              ? `url(${clip.thumbnailDataUrl})`
              : "linear-gradient(135deg,#1A2E44 0%,#1A7A4A 100%)",
          }}
        />
        <div className="absolute inset-0 bg-black/35" />

        <div
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="absolute left-0 top-0 w-5 h-full flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/20 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={11} className="text-white/80" />
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1 right-4 w-4 h-4 rounded-full bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X size={9} className="text-white" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-white text-[10px] font-medium truncate leading-tight">{clip.title}</p>
          <p className="text-white/60 text-[10px] leading-tight">{formatDuration(clip.duration)}</p>
        </div>

        <div
          className="absolute right-0 top-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-80 bg-white/25 transition-opacity z-10"
          onMouseDown={handleResizeDown}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {!isLast && (
        <TransitionDot
          clipId={clip.id}
          transitionType={clip.transitionType}
          onSelect={onTransition}
        />
      )}
    </div>
  );
}

// ─── StrategyProjectFolder ────────────────────────────────────────────────────

function StrategyProjectFolder({
  project,
  timeline,
  compileState,
  onAddScene,
  onAddAllScenes,
  onSuggestTransitions,
  onOverrideTransition,
  onConfirmCompile,
  onRetry,
}: {
  project: StrategyProject;
  timeline: TimelineClip[];
  compileState: ProjectCompileState;
  onAddScene: (scene: StrategySceneItem) => void;
  onAddAllScenes: (project: StrategyProject) => void;
  onSuggestTransitions: (projectId: string) => void;
  onOverrideTransition: (projectId: string, between: string, s: TransitionSuggestion) => void;
  onConfirmCompile: (projectId: string) => void;
  onRetry: (projectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const timelineUrls = timeline.map((c) => c.sourceUrl);
  const doneScenes = project.scenes.filter((s) => s.clipUrl);

  // True when every done scene's clip is in the timeline in ascending order
  const allInTimeline =
    doneScenes.length > 0 &&
    (() => {
      let lastIdx = -1;
      for (const s of doneScenes) {
        const idx = timelineUrls.indexOf(s.clipUrl!);
        if (idx === -1 || idx <= lastIdx) return false;
        lastIdx = idx;
      }
      return true;
    })();

  const totalDuration = doneScenes.reduce((a, s) => a + s.duration, 0);
  const firstScene = doneScenes[0];

  // Merge suggestions with overrides to get effective transition for a pair
  function effectiveTransition(between: string): TransitionSuggestion | undefined {
    return compileState.overrides[between] ?? compileState.suggestions.find((s) => s.between === between);
  }

  function handleDownload(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title.replace(/[^a-z0-9]/gi, "_")}_compiled.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const { phase, error, compiledUrl, suggestions } = compileState;
  const existingUrl = compiledUrl ?? project.exportUrl;

  // Show transitions whenever we have suggestions (reviewing / compiling / done)
  const showTransitions = suggestions.length > 0 && phase !== "idle" && phase !== "suggesting" && phase !== "failed";

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      {/* Folder header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 p-2.5 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-12 h-8 rounded-lg flex-shrink-0 overflow-hidden bg-gray-100">
          {firstScene?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={firstScene.imageUrl} alt="Scene 1" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1A2E44] to-[#1A7A4A]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#1A2E44] truncate leading-tight">{project.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-gray-400">{doneScenes.length} scene{doneScenes.length !== 1 ? "s" : ""}</span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-400">{totalDuration}s</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {existingUrl && phase !== "compiling" && (
            <span className="w-4 h-4 rounded-full bg-[#1A7A4A] flex items-center justify-center">
              <Check size={9} className="text-white" />
            </span>
          )}
          {expanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2.5 border-t border-gray-100 pt-2 space-y-0.5">

              {/* Scene list — with transition badges between items when reviewing */}
              {doneScenes.map((scene, idx) => {
                const inTimeline = timelineUrls.includes(scene.clipUrl ?? "");
                const pairKey = idx < doneScenes.length - 1
                  ? `${scene.sceneNumber}-${doneScenes[idx + 1].sceneNumber}`
                  : null;
                const effectiveTrans = pairKey ? effectiveTransition(pairKey) : undefined;

                return (
                  <div key={scene.id}>
                    <button
                      type="button"
                      onClick={() => onAddScene(scene)}
                      className={cn(
                        "w-full flex items-center gap-2 p-1.5 rounded-lg transition-colors group",
                        inTimeline ? "bg-[#E8F5EE] hover:bg-[#d4ede0]" : "hover:bg-gray-50"
                      )}
                    >
                      <div className="w-10 h-7 rounded flex-shrink-0 overflow-hidden bg-gray-100">
                        {scene.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#1A2E44] to-[#1A7A4A]" />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-[11px] font-medium text-gray-800">Scene {scene.sceneNumber}</p>
                        <p className="text-[10px] text-gray-400">{scene.duration}s</p>
                      </div>
                      {inTimeline ? (
                        <Check size={11} className="text-[#1A7A4A] flex-shrink-0" />
                      ) : (
                        <Plus size={11} className="text-[#1A7A4A] opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      )}
                    </button>

                    {/* Transition badge between this scene and the next */}
                    {pairKey && showTransitions && effectiveTrans && (
                      <TransitionInlineEditor
                        suggestion={effectiveTrans}
                        disabled={phase === "compiling" || phase === "done"}
                        onOverride={(s) => onOverrideTransition(project.id, pairKey, s)}
                      />
                    )}
                  </div>
                );
              })}

              {/* Add All button */}
              <button
                type="button"
                onClick={() => onAddAllScenes(project)}
                className="w-full mt-2 border border-gray-200 rounded-lg py-1.5 text-[11px] font-medium text-gray-700 flex items-center justify-center gap-1 hover:bg-gray-50 transition-colors"
              >
                <Layers size={11} />
                Add All Scenes
              </button>

              {/* ─── Compile state machine ─── */}
              {allInTimeline && (
                <div className="mt-1.5 space-y-1">
                  {/* IDLE */}
                  {phase === "idle" && (
                    <button
                      type="button"
                      onClick={() => onSuggestTransitions(project.id)}
                      className="w-full bg-[#1A7A4A] text-white rounded-lg py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#156040] transition-colors shadow-sm"
                    >
                      <Zap size={12} />
                      Compile with Transitions
                    </button>
                  )}

                  {/* SUGGESTING */}
                  {phase === "suggesting" && (
                    <div className="flex items-center justify-center gap-2 py-2.5 bg-[#E8F5EE] rounded-lg">
                      <Loader2 size={12} className="animate-spin text-[#1A7A4A]" />
                      <span className="text-[11px] text-[#1A7A4A] font-medium">Getting AI transition suggestions…</span>
                    </div>
                  )}

                  {/* REVIEWING */}
                  {phase === "reviewing" && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider text-center">
                        <Sparkles size={9} className="inline mr-0.5" />
                        AI Suggestions · click to override
                      </p>
                      <button
                        type="button"
                        onClick={() => onConfirmCompile(project.id)}
                        className="w-full bg-[#1A7A4A] text-white rounded-lg py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#156040] transition-colors shadow-sm"
                      >
                        <Check size={12} />
                        Confirm &amp; Compile
                      </button>
                      <button
                        type="button"
                        onClick={() => onSuggestTransitions(project.id)}
                        className="w-full text-center text-[10px] text-gray-400 hover:text-gray-600 transition-colors py-0.5 flex items-center justify-center gap-1"
                      >
                        <RefreshCw size={9} />
                        Re-suggest
                      </button>
                    </div>
                  )}

                  {/* COMPILING */}
                  {phase === "compiling" && (
                    <div className="flex items-center justify-center gap-2 py-2.5 bg-[#E8F5EE] rounded-lg">
                      <Loader2 size={12} className="animate-spin text-[#1A7A4A]" />
                      <span className="text-[11px] text-[#1A7A4A] font-medium">Stitching with FFmpeg…</span>
                    </div>
                  )}

                  {/* DONE */}
                  {phase === "done" && existingUrl && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#E8F5EE] rounded-lg">
                        <Check size={11} className="text-[#1A7A4A]" />
                        <span className="text-[11px] font-semibold text-[#1A7A4A]">Compiled successfully!</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownload(existingUrl)}
                        className="w-full bg-[#1A7A4A] text-white rounded-lg py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#156040] transition-colors"
                      >
                        <Download size={12} />
                        Download Compiled Video
                      </button>
                    </div>
                  )}

                  {/* FAILED */}
                  {phase === "failed" && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-red-500 text-center">
                        {error ?? "Compile failed. Please try again."}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRetry(project.id)}
                        className="w-full bg-[#1A7A4A] text-white rounded-lg py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#156040] transition-colors"
                      >
                        <RefreshCw size={12} />
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Download button when already compiled but scenes not all in timeline */}
              {!allInTimeline && existingUrl && (
                <button
                  type="button"
                  onClick={() => handleDownload(existingUrl)}
                  className="w-full mt-1 border border-[#1A7A4A] text-[#1A7A4A] rounded-lg py-1.5 text-[11px] font-medium flex items-center justify-center gap-1 hover:bg-[#E8F5EE] transition-colors"
                >
                  <Download size={11} />
                  Download Compiled
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── GenerateModal ────────────────────────────────────────────────────────────

function GenerateModal({
  onClose,
  onGenerated,
  projectId,
}: {
  onClose: () => void;
  onGenerated: (clip: LibraryClip) => void;
  projectId: string | null;
}) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<4 | 8>(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [refUploadError, setRefUploadError] = useState<string | null>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  async function handleRefImageSelect(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => setRefImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setRefImageUrl(null); setRefUploadError(null); setUploadingRef(true);
    try {
      const fd = new FormData();
      fd.append("video", file);
      const res = await apiClient.post("/api/uploads/video-clip", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { clipUrl } = res.data.data as { clipUrl: string; duration: number };
      setRefImageUrl(clipUrl);
    } catch {
      setRefUploadError("Image upload failed. Try again.");
      setRefImagePreview(null);
    } finally { setUploadingRef(false); }
  }

  async function handleGenerate() {
    if (!projectId) { setError("Create or select a project first."); return; }
    if (!prompt.trim()) { setError("Please describe the clip."); return; }
    if (uploadingRef) { setError("Please wait for the reference image to finish uploading."); return; }
    setLoading(true); setError(null);
    try {
      const body: { prompt: string; duration: number; imageUrl?: string } = {
        prompt: prompt.trim(), duration,
        ...(refImageUrl ? { imageUrl: refImageUrl } : {}),
      };
      const res = await apiClient.post(`/api/videos/${projectId}/generate-clip`, body);
      const url: string = res.data.data.clipUrl;
      const thumb = await extractThumbnail(url);
      onGenerated({ id: uid(), url, title: prompt.slice(0, 40), duration, thumbnailDataUrl: thumb, source: "ai" });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg ?? "Generation failed. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#1A2E44]">Generate AI Clip</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        {loading ? (
          <div className="py-10 flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#1A7A4A]" />
            <p className="text-sm text-gray-600 text-center">
              AI is generating your clip…<br />
              <span className="text-xs text-gray-400">(this takes 30–60 seconds)</span>
            </p>
          </div>
        ) : (
          <>
            <label className="block text-xs font-medium text-gray-700 mb-1">Describe the clip</label>
            <textarea
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              rows={3} maxLength={500}
              placeholder="e.g. A product being showcased on a clean white surface with soft lighting…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#1A7A4A]/30 focus:border-[#1A7A4A]"
            />
            <p className="text-right text-[10px] text-gray-400 mt-0.5">{prompt.length}/500</p>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Reference Image <span className="text-gray-400 font-normal">(optional — used as first frame)</span>
              </label>
              <input ref={refImageInputRef} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRefImageSelect(f); e.target.value = ""; }}
              />
              {refImagePreview ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={refImagePreview} alt="Reference" className="w-full h-full object-cover" />
                  {uploadingRef && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                  )}
                  {!uploadingRef && refImageUrl && (
                    <div className="absolute top-2 right-2 bg-[#1A7A4A] rounded-full p-1">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                  <button type="button" onClick={() => { setRefImagePreview(null); setRefImageUrl(null); setRefUploadError(null); }}
                    className="absolute top-2 left-2 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => refImageInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 flex flex-col items-center gap-1.5 hover:border-[#1A7A4A] hover:bg-[#E8F5EE]/40 transition-colors group"
                >
                  <ImageIcon size={18} className="text-gray-300 group-hover:text-[#1A7A4A] transition-colors" />
                  <span className="text-xs text-gray-400 group-hover:text-[#1A7A4A] transition-colors">Upload reference image</span>
                  <span className="text-[10px] text-gray-300">JPG, PNG</span>
                </button>
              )}
              {refUploadError && <p className="mt-1 text-[10px] text-red-500">{refUploadError}</p>}
            </div>

            <label className="block text-xs font-medium text-gray-700 mt-3 mb-2">Duration</label>
            <div className="flex gap-2">
              {([4, 8] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDuration(d)}
                  className={cn("flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                    duration === d ? "border-[#1A7A4A] bg-[#E8F5EE] text-[#1A7A4A]" : "border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >{d}s</button>
              ))}
            </div>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <button type="button" onClick={handleGenerate} disabled={!prompt.trim() || uploadingRef}
              className="mt-4 w-full bg-[#1A7A4A] text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#156040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={15} />
              {refImageUrl ? "Generate from Image + Prompt" : "Generate"} (15 credits)
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VideoStudioPage() {
  const {
    currentProjectId, timeline, selectedClipId,
    isExporting, exportUrl, isRefining,
    setProject, setTimeline, addClipToTimeline, removeClipFromTimeline,
    setSelectedClip, setExporting, setExportUrl, setRefining,
    updateClipTransition, updateClipDuration, setClipThumbnail,
  } = useVideoStore();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const user = useAuthStore((s) => s.user);

  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const [editingTitle, setEditingTitle] = useState(false);

  const [libraryClips, setLibraryClips] = useState<LibraryClip[]>([]);
  const [activeMediaTab, setActiveMediaTab] = useState<"my" | "ai" | "projects">("my");
  const [uploadingClip, setUploadingClip] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Strategy projects + per-project compile state
  const [strategyProjects, setStrategyProjects] = useState<StrategyProject[]>([]);
  const [loadingStrategyProjects, setLoadingStrategyProjects] = useState(false);
  const [compileStates, setCompileStates] = useState<Record<string, ProjectCompileState>>({});

  const [exportPhase, setExportPhase] = useState<"idle" | "queued" | "completed" | "failed">("idle");
  const [downloading, setDownloading] = useState(false);

  const [refineResult, setRefineResult] = useState<RefinementResult | null>(null);
  const [showRefinePanel, setShowRefinePanel] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewQueueRef = useRef<string[]>([]);
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const lastSavedRef = useRef<string>("[]");
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  function showToast(msg: string, type: "success" | "error" = "success") {
    if (type === "error") toast.error(msg);
    else toast.success(msg);
  }

  function getCompileState(projectId: string): ProjectCompileState {
    return compileStates[projectId] ?? DEFAULT_COMPILE_STATE;
  }

  function setCompileState(projectId: string, update: Partial<ProjectCompileState>) {
    setCompileStates((prev) => ({
      ...prev,
      [projectId]: { ...DEFAULT_COMPILE_STATE, ...prev[projectId], ...update },
    }));
  }

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    apiClient.get("/api/videos").then((res) => {
      const items: Project[] = res.data.data?.items ?? [];
      setProjects(items);
      if (items.length > 0 && !currentProjectId) loadProject(items[0]);
    }).catch(() => {});
    loadStrategyProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStrategyProjects() {
    setLoadingStrategyProjects(true);
    try {
      const res = await apiClient.get("/api/strategy/projects-with-scenes");
      const items: StrategyProject[] = res.data.data ?? [];
      setStrategyProjects(items);
      // Pre-populate "done" state from DB exportUrl
      setCompileStates((prev) => {
        const next = { ...prev };
        for (const p of items) {
          if (p.exportUrl && (!prev[p.id] || prev[p.id].phase === "idle")) {
            next[p.id] = { ...DEFAULT_COMPILE_STATE, phase: "done", compiledUrl: p.exportUrl };
          }
        }
        return next;
      });
    } catch { /* silent */ }
    finally { setLoadingStrategyProjects(false); }
  }

  function loadProject(p: Project) {
    setProject(p.id);
    setProjectTitle(p.title);
    setExportPhase(p.status === "COMPLETED" ? "completed" : "idle");
    setExportUrl(p.exportUrl);
    apiClient.get(`/api/videos/${p.id}`).then((res) => {
      const raw = (res.data.data?.timelineData ?? []) as TimelineClip[];
      const clips = raw.map((c) => ({ ...c, thumbnailDataUrl: null as null }));
      setTimeline(clips);
      clips.forEach((c) => extractThumbnail(c.sourceUrl).then((t) => { if (t) setClipThumbnail(c.id, t); }));
    }).catch(() => {});
  }

  // ── Auto-save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentProjectId) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(async () => {
      const payload = timeline.map((c) => ({
        id: c.id, sourceUrl: c.sourceUrl,
        duration: Math.max(1, Math.round(c.duration)),
        transitionType: c.transitionType === "wipe-left" || c.transitionType === "wipe-right"
          ? "none" as const : (c.transitionType ?? "none" as const),
        title: c.title,
      }));
      const serial = JSON.stringify(payload);
      if (serial === lastSavedRef.current) return;
      try {
        await apiClient.put(`/api/videos/${currentProjectId}/timeline`, { clips: payload });
        lastSavedRef.current = serial;
      } catch { /* silent */ }
    }, AUTOSAVE_DELAY);
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  }, [timeline, currentProjectId]);

  // ── Preview events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      if (previewQueueRef.current.length > 0) {
        const next = previewQueueRef.current.shift()!;
        video.src = next; video.play().catch(() => {});
      } else {
        setIsFullPreview(false); setIsPlaying(false);
      }
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const clip = timeline.find((c) => c.id === selectedClipId);
    if (clip && videoRef.current && !isFullPreview) {
      videoRef.current.src = clip.sourceUrl;
      videoRef.current.load();
    }
  }, [selectedClipId, timeline, isFullPreview]);

  // ── Export polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (exportPhase !== "queued" || !currentProjectId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get(`/api/videos/${currentProjectId}/export-status`);
        const { status, exportUrl: url } = res.data.data as { status: string; exportUrl: string | null };
        if (status === "COMPLETED") {
          setExportPhase("completed"); setExportUrl(url); setExporting(false);
          showToast("Export complete! Your video is ready.");
          clearInterval(pollRef.current!); pollRef.current = null;
        } else if (status === "FAILED") {
          setExportPhase("failed"); setExporting(false);
          showToast("Export failed. Please try again.", "error");
          clearInterval(pollRef.current!); pollRef.current = null;
        }
      } catch { /* ignore */ }
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [exportPhase, currentProjectId]);

  // ── Compile handlers ───────────────────────────────────────────────────────

  async function handleSuggestTransitions(projectId: string) {
    const project = strategyProjects.find((p) => p.id === projectId);
    setCompileState(projectId, { phase: "suggesting", error: null, suggestions: [], overrides: {} });
    try {
      const res = await apiClient.get(`/api/strategy/suggest-transitions/${projectId}`);
      const suggestions: TransitionSuggestion[] = res.data.data.transitions ?? [];
      setCompileState(projectId, { phase: "reviewing", suggestions });
    } catch {
      // Fallback: crossfade 500ms for all pairs
      const doneScenes = project?.scenes.filter((s) => s.clipUrl) ?? [];
      const fallback: TransitionSuggestion[] = Array.from(
        { length: Math.max(0, doneScenes.length - 1) },
        (_, i) => ({
          between: `${doneScenes[i].sceneNumber}-${doneScenes[i + 1].sceneNumber}`,
          transition: "crossfade" as AiTransitionType,
          duration_ms: 500,
        })
      );
      setCompileState(projectId, { phase: "reviewing", suggestions: fallback });
    }
  }

  function handleOverrideTransition(projectId: string, between: string, s: TransitionSuggestion) {
    setCompileStates((prev) => ({
      ...prev,
      [projectId]: {
        ...DEFAULT_COMPILE_STATE,
        ...prev[projectId],
        overrides: { ...(prev[projectId]?.overrides ?? {}), [between]: s },
      },
    }));
  }

  async function handleConfirmCompile(projectId: string) {
    const state = getCompileState(projectId);
    const finalTransitions = state.suggestions.map((s) => state.overrides[s.between] ?? s);
    setCompileState(projectId, { phase: "compiling", error: null });
    try {
      const res = await apiClient.post(
        `/api/strategy/compile/${projectId}`,
        { transitions: finalTransitions },
        { timeout: 300_000 }
      );
      const { compiledUrl, transitions } = res.data.data as { compiledUrl: string; transitions: TransitionSuggestion[] };
      setCompileState(projectId, { phase: "done", compiledUrl, suggestions: transitions });
      loadStrategyProjects();
      showToast("Compilation complete! Download your video below.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setCompileState(projectId, { phase: "failed", error: msg ?? "Compile failed. Please try again." });
      showToast(msg ?? "Compile failed.", "error");
    }
  }

  function handleRetryCompile(projectId: string) {
    // Go back to reviewing with existing suggestions so user can retry
    const state = getCompileState(projectId);
    if (state.suggestions.length > 0) {
      setCompileState(projectId, { phase: "reviewing", error: null });
    } else {
      setCompileState(projectId, { phase: "idle", error: null });
    }
  }

  // ── Library actions ────────────────────────────────────────────────────────

  async function handleCreateProject() {
    setCreatingProject(true);
    try {
      const res = await apiClient.post("/api/videos", { title: "Untitled Project" });
      const p: Project = res.data.data;
      setProjects((prev) => [p, ...prev]);
      setProject(p.id); setProjectTitle(p.title); setTimeline([]);
      setExportPhase("idle"); setExportUrl(null); lastSavedRef.current = "[]";
    } catch { showToast("Failed to create project."); }
    finally { setCreatingProject(false); }
  }

  async function handleUploadClip(file: File) {
    setUploadingClip(true); setUploadError(null);
    try {
      const fd = new FormData(); fd.append("video", file);
      const res = await apiClient.post("/api/uploads/video-clip", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { clipUrl, duration: d } = res.data.data as { clipUrl: string; duration: number };
      const dur = d ?? await getVideoDuration(clipUrl);
      const thumb = await extractThumbnail(clipUrl);
      setLibraryClips((p) => [
        { id: uid(), url: clipUrl, title: file.name.replace(/\.[^.]+$/, ""), duration: dur, thumbnailDataUrl: thumb, source: "uploaded" },
        ...p,
      ]);
    } catch { setUploadError("Upload failed. Supported: MP4, MOV, WebM, JPG, PNG."); }
    finally { setUploadingClip(false); }
  }

  function addToTimeline(lib: LibraryClip) {
    if (!currentProjectId) { showToast("Create a project first."); return; }
    const clip: TimelineClip = {
      id: uid(), sourceUrl: lib.url, title: lib.title,
      duration: lib.duration, thumbnailDataUrl: lib.thumbnailDataUrl,
      transitionType: "none", source: lib.source,
    };
    addClipToTimeline(clip);
    setSelectedClip(clip.id);
  }

  function addSceneToTimeline(scene: StrategySceneItem) {
    if (!currentProjectId) { showToast("Create a project first."); return; }
    if (!scene.clipUrl) { showToast("Scene clip not ready yet."); return; }
    if (timeline.some((c) => c.sourceUrl === scene.clipUrl)) {
      showToast(`Scene ${scene.sceneNumber} is already in the timeline.`);
      return;
    }
    const clipId = uid();
    const clip: TimelineClip = {
      id: clipId, sourceUrl: scene.clipUrl,
      title: `Scene ${scene.sceneNumber}`,
      duration: scene.duration, thumbnailDataUrl: null,
      transitionType: "crossfade", source: "ai",
    };
    addClipToTimeline(clip);
    setSelectedClip(clipId);
    if (scene.imageUrl) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 160; canvas.height = 90;
          canvas.getContext("2d")?.drawImage(img, 0, 0, 160, 90);
          setClipThumbnail(clipId, canvas.toDataURL("image/jpeg", 0.7));
        } catch { /* ignore */ }
      };
      img.src = scene.imageUrl;
    }
  }

  function addAllScenesFromProject(project: StrategyProject) {
    if (!currentProjectId) { showToast("Create a project first."); return; }
    const doneScenes = project.scenes.filter((s) => s.clipUrl);
    if (doneScenes.length === 0) { showToast("No completed scenes to add."); return; }
    let added = 0;
    for (const scene of doneScenes) {
      if (timeline.some((c) => c.sourceUrl === scene.clipUrl)) continue;
      const clipId = uid();
      const clip: TimelineClip = {
        id: clipId, sourceUrl: scene.clipUrl!,
        title: `${project.title} — Scene ${scene.sceneNumber}`,
        duration: scene.duration, thumbnailDataUrl: null,
        transitionType: "crossfade", source: "ai",
      };
      addClipToTimeline(clip);
      if (added === 0) setSelectedClip(clipId);
      added++;
      if (scene.imageUrl) {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 160; canvas.height = 90;
            canvas.getContext("2d")?.drawImage(img, 0, 0, 160, 90);
            setClipThumbnail(clipId, canvas.toDataURL("image/jpeg", 0.7));
          } catch { /* ignore */ }
        };
        img.src = scene.imageUrl;
      }
    }
    showToast(added > 0 ? `Added ${added} scene${added !== 1 ? "s" : ""} to timeline.` : "All scenes already in timeline.");
  }

  // ── Other actions ──────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oi = timeline.findIndex((c) => c.id === active.id);
      const ni = timeline.findIndex((c) => c.id === over.id);
      setTimeline(arrayMove(timeline, oi, ni));
    }
  }

  function handleFullscreen() {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else v.requestFullscreen().catch(() => {});
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v || !timeline.length) return;
    if (!v.currentSrc || v.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      const clip = timeline.find((c) => c.id === selectedClipId) ?? timeline[0];
      v.src = clip.sourceUrl;
      setSelectedClip(clip.id);
      v.load();
      v.addEventListener("canplay", () => v.play().catch(() => {}), { once: true });
      return;
    }
    isPlaying ? v.pause() : v.play().catch(() => {});
  }

  function startFullPreview() {
    if (!timeline.length || !videoRef.current) return;
    const v = videoRef.current;
    previewQueueRef.current = timeline.slice(1).map((c) => c.sourceUrl);
    setIsFullPreview(true);
    v.src = timeline[0].sourceUrl;
    v.load();
    v.addEventListener("canplay", () => v.play().catch(() => {}), { once: true });
  }

  async function handleDownload() {
    const clip = timeline.find((c) => c.id === selectedClipId) ?? timeline[0];
    if (!clip) return;
    setDownloading(true);
    try {
      const res = await fetch(clip.sourceUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${clip.title || "video"}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      showToast("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleAiRefine() {
    if (!currentProjectId || !timeline.length) return;
    setRefining(true); setShowRefinePanel(false); setRefineResult(null);
    try {
      const res = await apiClient.post(`/api/videos/${currentProjectId}/refine`, {
        clips: timeline.map((c) => ({ id: c.id, duration: c.duration })),
      });
      setRefineResult(res.data.data as RefinementResult); setShowRefinePanel(true);
    } catch { showToast("AI Refine is not available yet."); }
    finally { setRefining(false); }
  }

  function acceptRefine() {
    if (!refineResult) return;
    for (const ch of refineResult.updatedClips) updateClipTransition(ch.id, ch.transitionType);
    setShowRefinePanel(false); setRefineResult(null);
    showToast("Transitions updated.");
  }

  async function saveTitle() {
    setEditingTitle(false);
  }

  const totalDuration = timeline.reduce((a, c) => a + c.duration, 0);
  const myClips = libraryClips.filter((c) => c.source === "uploaded");
  const aiClips = libraryClips.filter((c) => c.source === "ai");

  // ── Render ─────────────────────────────────────────────────────────────────

  // FREE plan gate — show upgrade overlay instead of the studio
  if (user?.plan === "FREE") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 bg-[#E8F5EE] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Film size={28} className="text-[#1A7A4A]" />
          </div>
          <h2 className="text-xl font-bold text-[#1A2E44] mb-2">Video Studio</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Video Studio requires a Pro or Business plan. Upgrade to create, generate, and export AI videos.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 bg-[#1A7A4A] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#156040] transition-colors shadow-sm"
          >
            <Zap size={15} />
            Upgrade Now
          </a>
          <p className="text-xs text-gray-400 mt-3">
            Starting at ₹999/month · 500 credits included
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex -m-6 overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>

        {/* ─────────────── LEFT PANEL ─────────────── */}
        <aside className="w-[280px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-sm font-bold text-[#1A2E44] mb-3">Video Studio</h2>
            <button type="button" onClick={handleCreateProject} disabled={creatingProject}
              className="w-full bg-[#1A7A4A] text-white rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#156040] transition-colors disabled:opacity-50 mb-2"
            >
              {creatingProject ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              New Project
            </button>
            <div className="relative">
              <button type="button" onClick={() => setShowProjectDropdown((v) => !v)}
                className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 hover:border-gray-300 transition-colors"
              >
                <span className="truncate">{projectTitle}</span>
                <ChevronDown size={12} className="text-gray-400 ml-1 flex-shrink-0" />
              </button>
              <AnimatePresence>
                {showProjectDropdown && projects.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto"
                  >
                    {projects.map((p) => (
                      <button key={p.id} type="button"
                        onClick={() => { loadProject(p); setShowProjectDropdown(false); }}
                        className={cn("w-full text-left px-3 py-2 text-xs transition-colors",
                          p.id === currentProjectId ? "bg-[#E8F5EE] text-[#1A7A4A] font-medium" : "text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        {p.title}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 3-tab Media Library */}
          <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Media Library</p>
            <div className="flex rounded-lg bg-gray-100 p-0.5">
              {(["my", "ai", "projects"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveMediaTab(tab)}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors relative",
                    activeMediaTab === tab ? "bg-white text-[#1A2E44] shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab === "my" ? "My Clips" : tab === "ai" ? "AI Clips" : "Projects"}
                  {tab === "projects" && strategyProjects.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#1A7A4A] text-white rounded-full text-[8px] flex items-center justify-center font-bold">
                      {strategyProjects.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Clip / Project list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {(activeMediaTab === "my" || activeMediaTab === "ai") && (
              <>
                {(activeMediaTab === "my" ? myClips : aiClips).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Film size={22} className="text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">
                      {activeMediaTab === "my" ? "No clips uploaded yet" : "No AI clips generated yet"}
                    </p>
                  </div>
                ) : (
                  (activeMediaTab === "my" ? myClips : aiClips).map((lib) => (
                    <button key={lib.id} type="button" onClick={() => addToTimeline(lib)}
                      className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-[#E8F5EE] transition-colors group"
                    >
                      <div className="w-14 h-9 rounded-lg flex-shrink-0 bg-cover bg-center"
                        style={{ background: lib.thumbnailDataUrl ? `url(${lib.thumbnailDataUrl}) center/cover` : "linear-gradient(135deg,#1A2E44 0%,#1A7A4A 100%)" }}
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium text-gray-800 truncate leading-tight">{lib.title}</p>
                        <p className="text-[10px] text-gray-400">{formatDuration(lib.duration)}</p>
                      </div>
                      <Plus size={13} className="text-[#1A7A4A] opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    </button>
                  ))
                )}
              </>
            )}

            {activeMediaTab === "projects" && (
              <>
                {loadingStrategyProjects ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 size={18} className="animate-spin text-gray-300" />
                    <p className="text-xs text-gray-400">Loading projects…</p>
                  </div>
                ) : strategyProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-2">
                    <Folder size={22} className="text-gray-300 mb-2" />
                    <p className="text-xs text-gray-500 font-medium mb-1">No scene projects yet</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      Generate video scenes from your Strategy page to see them here as compilable folders.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {strategyProjects.map((project) => (
                      <StrategyProjectFolder
                        key={project.id}
                        project={project}
                        timeline={timeline}
                        compileState={getCompileState(project.id)}
                        onAddScene={addSceneToTimeline}
                        onAddAllScenes={addAllScenesFromProject}
                        onSuggestTransitions={handleSuggestTransitions}
                        onOverrideTransition={handleOverrideTransition}
                        onConfirmCompile={handleConfirmCompile}
                        onRetry={handleRetryCompile}
                      />
                    ))}
                    <button type="button" onClick={loadStrategyProjects}
                      className="w-full text-center text-[10px] text-gray-400 hover:text-gray-600 transition-colors py-1 flex items-center justify-center gap-1"
                    >
                      <RefreshCw size={9} />
                      Refresh
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Upload / Generate — hidden in Projects tab */}
          {activeMediaTab !== "projects" && (
            <div className="p-3 border-t border-gray-100 space-y-2 flex-shrink-0">
              <input ref={fileInputRef} type="file"
                accept=".mp4,.mov,.webm,.jpg,.jpeg,.png,video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadClip(f); e.target.value = ""; }}
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingClip}
                className="w-full border border-gray-200 rounded-xl py-2 text-xs font-medium text-gray-700 flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {uploadingClip ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploadingClip ? "Uploading…" : "Upload Clip"}
              </button>
              {uploadError && <p className="text-[10px] text-red-500">{uploadError}</p>}
              <button type="button" onClick={() => setShowGenerateModal(true)}
                className="w-full bg-[#1A2E44] text-white rounded-xl py-2 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-[#152638] transition-colors"
              >
                <Sparkles size={12} />
                Generate AI Clip
              </button>
            </div>
          )}
        </aside>

        {/* ─────────────── CENTER — TIMELINE ─────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-gray-50 border-r border-gray-100">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-white flex-shrink-0">
            <p className="text-xs font-medium text-gray-500">
              Timeline — drag clips to reorder
              {timeline.length > 0 && (
                <span className="ml-2 text-gray-400">
                  {timeline.length} clip{timeline.length !== 1 ? "s" : ""} · {formatDuration(totalDuration)}
                </span>
              )}
            </p>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {timeline.length === 0 ? (
              <div className="absolute inset-4 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center">
                <Film size={32} className="text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm font-medium">Add clips to get started</p>
                <p className="text-gray-400 text-xs mt-1">Upload or generate a clip from the left panel</p>
              </div>
            ) : (
              <div className="h-full overflow-x-auto overflow-y-hidden">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={timeline.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                    <div className="flex items-end gap-0 h-full px-4 pb-6 pt-8 min-w-max">
                      {timeline.map((clip, i) => (
                        <SortableClipBlock
                          key={clip.id}
                          clip={clip}
                          isSelected={clip.id === selectedClipId}
                          onClick={() => setSelectedClip(clip.id)}
                          onRemove={() => removeClipFromTimeline(clip.id)}
                          onResize={updateClipDuration}
                          onTransition={updateClipTransition}
                          isLast={i === timeline.length - 1}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>

        {/* ─────────────── RIGHT PANEL ─────────────── */}
        <aside className="w-[320px] flex-shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Preview</p>
            <div className="relative bg-gray-100 border border-gray-200 rounded-xl overflow-hidden aspect-video mb-2 group/preview">
              <video ref={videoRef} className="w-full h-full object-contain" playsInline preload="metadata" />
              {!timeline.length && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video size={28} className="text-gray-600" />
                </div>
              )}
              {timeline.length > 0 && (
                <button type="button" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={handleFullscreen}
                  className="absolute top-2 right-2 w-7 h-7 rounded-md bg-black/50 flex items-center justify-center text-white opacity-0 group-hover/preview:opacity-100 transition-opacity hover:bg-black/70"
                >
                  {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={togglePlay} disabled={!timeline.length}
                className="w-9 h-9 rounded-lg bg-[#1A7A4A] flex items-center justify-center text-white hover:bg-[#156040] transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button type="button" onClick={startFullPreview} disabled={!timeline.length}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Play Full Preview
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Project</p>
            {editingTitle ? (
              <input type="text" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)}
                onBlur={saveTitle} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); }}
                autoFocus className="w-full border border-[#1A7A4A] rounded-lg px-2 py-1 text-sm text-[#1A2E44] font-semibold focus:outline-none"
              />
            ) : (
              <button type="button" onClick={() => setEditingTitle(true)}
                className="w-full text-left text-sm font-semibold text-[#1A2E44] hover:text-[#1A7A4A] transition-colors truncate" title="Click to rename"
              >
                {projectTitle}
              </button>
            )}
            <div className="flex items-center gap-1 mt-1">
              <Clock size={11} className="text-gray-400" />
              <p className="text-xs text-gray-400">
                {timeline.length} clip{timeline.length !== 1 ? "s" : ""} · {formatDuration(totalDuration)}
              </p>
            </div>
          </div>

          <div className="p-4 border-b border-gray-100">
            <button type="button" onClick={handleAiRefine} disabled={isRefining || !timeline.length}
              className="w-full border border-[#1A7A4A] text-[#1A7A4A] rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#E8F5EE] transition-colors disabled:opacity-50"
            >
              {isRefining ? (
                <><Loader2 size={14} className="animate-spin" /> AI is analysing your timeline…</>
              ) : (
                <><Sparkles size={14} /> AI Refine</>
              )}
            </button>
            <AnimatePresence>
              {showRefinePanel && refineResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-3 bg-[#E8F5EE] rounded-xl p-3 overflow-hidden"
                >
                  <p className="text-xs font-semibold text-[#1A2E44] mb-1">AI Suggestion</p>
                  <p className="text-xs text-gray-600 mb-3 leading-relaxed">{refineResult.summary}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={acceptRefine}
                      className="flex-1 bg-[#1A7A4A] text-white rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Check size={11} /> Accept Changes
                    </button>
                    <button type="button" onClick={() => { setShowRefinePanel(false); setRefineResult(null); }}
                      className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Undo2 size={11} /> Undo
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4">
            <button type="button" onClick={handleDownload} disabled={!timeline.length || downloading}
              className="w-full bg-[#1A7A4A] text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#156040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <><Loader2 size={15} className="animate-spin" /> Downloading…</>
              ) : (
                <><Download size={15} /> Download Video</>
              )}
            </button>
            {timeline.length > 1 && !downloading && (
              <p className="text-[10px] text-gray-400 text-center mt-1.5">Downloads the selected clip</p>
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showGenerateModal && (
          <GenerateModal
            projectId={currentProjectId}
            onClose={() => setShowGenerateModal(false)}
            onGenerated={(clip) => {
              setLibraryClips((p) => [clip, ...p]);
              setActiveMediaTab("ai");
              showToast("AI clip ready — click it to add to timeline.");
            }}
          />
        )}
      </AnimatePresence>

    </>
  );
}
