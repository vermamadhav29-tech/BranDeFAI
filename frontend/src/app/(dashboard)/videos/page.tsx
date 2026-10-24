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
  { value: "crossfade", label: "Crossfade", icon: "" },
  { value: "hard_cut", label: "Hard Cut", icon: "" },
  { value: "fade_to_black", label: "Fade to Black", icon: "" },
  { value: "slide_left", label: "Slide Left", icon: "" },
  { value: "zoom_out", label: "Zoom Out", icon: "" },
];

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
    transitionType === "crossfade" ? "#5235ef" :
    transitionType !== "none" ? "#3b82f6" : "#c9ccd6";

  return (
    <div ref={ref} className="bd-tdot">
      <button
        type="button"
        title="Set transition"
        aria-label="Set transition"
        style={{ background: dotColor }}
        onClick={() => setOpen((v) => !v)}
      />
      <>
        {open && (
          <div className="menu">
            <p>Transition</p>
            {TRANSITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onSelect(clipId, opt.value); setOpen(false); }}
              >
                {transitionType === opt.value ? <Check size={12} /> : <span style={{ width: 12 }} />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </>
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
  const meta = AI_TRANSITION_OPTIONS.find((o) => o.value === suggestion.transition);

  return (
    <div>
      {/* Connector line + badge */}
      <div className="bd-tbadge">
        {disabled ? (
          <span>
            <span>{meta?.icon}</span>
            {meta?.label}
            {suggestion.transition !== "hard_cut" && <span>· {suggestion.duration_ms}ms</span>}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
          >
            <span>{meta?.icon}</span>
            {meta?.label}
            {suggestion.transition !== "hard_cut" && <span>· {suggestion.duration_ms}ms</span>}
            <ChevronDown size={11} />
          </button>
        )}
      </div>

      {/* Inline override panel */}
      <>
        {open && (
          <div>
            <div>
              {/* Type pills */}
              <div>
                <p className="bd-eyebrow" style={{ margin: "6px 8px 0" }}>Type</p>
                <div className="bd-pills">
                  {AI_TRANSITION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onOverride({ ...suggestion, transition: opt.value });
                        setOpen(false);
                      }}
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
                  <p className="bd-eyebrow" style={{ margin: "0 8px" }}>Duration</p>
                  <div className="bd-pills">
                    {[300, 500, 700].map((ms) => (
                      <button
                        key={ms}
                        type="button"
                        onClick={() => {
                          onOverride({ ...suggestion, duration_ms: ms });
                          setOpen(false);
                        }}
                      >
                        {ms}ms
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </>
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
    backgroundImage: clip.thumbnailDataUrl ? `url(${clip.thumbnailDataUrl})` : undefined,
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
    <div className="bd-clipwrap">
      <div
        ref={setNodeRef}
        style={style}
        className={`bd-clip${isSelected ? " is-sel" : ""}`}
        onClick={onClick}
      >
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="grip"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </div>

        <button
          type="button"
          className="rm"
          aria-label="Remove clip"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <X size={13} />
        </button>

        <div className="meta">
          <b>{clip.title}</b>
          <span>{formatDuration(clip.duration)}</span>
        </div>

        <div
          className="rs"
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
    <div className="bd-folder">
      {/* Folder header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className="th"
          style={firstScene?.imageUrl ? { backgroundImage: `url(${firstScene.imageUrl})` } : undefined}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <b style={{ display: "block", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.title}</b>
          <span style={{ fontSize: 12, color: "var(--gray)" }}>
            {doneScenes.length} scene{doneScenes.length !== 1 ? "s" : ""} · {totalDuration}s
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {existingUrl && phase !== "compiling" && (
            <span className="bd-chip g" style={{ height: 20, padding: "0 6px" }}>
              <Check size={11} />
            </span>
          )}
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {/* Expanded body */}
      <>
        {expanded && (
          <div className="bd-body">
            <div style={{ display: "grid", gap: 6 }}>

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
                      className="bd-libitem"
                      onClick={() => onAddScene(scene)}
                    >
                      <div
                        className="th"
                        style={scene.imageUrl ? { backgroundImage: `url(${scene.imageUrl})` } : undefined}
                      />
                      <div className="tx">
                        <b>Scene {scene.sceneNumber}</b>
                        <span>{scene.duration}s</span>
                      </div>
                      {inTimeline ? (
                        <Check size={16} color="#12744e" />
                      ) : (
                        <Plus size={16} />
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
                className="bd-btn bd-btn-ghost bd-btn-sm"
                onClick={() => onAddAllScenes(project)}
              >
                <Layers size={14} />
                Add All Scenes
              </button>

              {/* ─── Compile state machine ─── */}
              {allInTimeline && (
                <div style={{ display: "grid", gap: 8 }}>
                  {/* IDLE */}
                  {phase === "idle" && (
                    <button
                      type="button"
                      className="bd-btn bd-btn-primary bd-btn-sm"
                      onClick={() => onSuggestTransitions(project.id)}
                    >
                      <Zap size={14} />
                      Compile with Transitions
                    </button>
                  )}

                  {/* SUGGESTING */}
                  {phase === "suggesting" && (
                    <div className="bd-chip p" style={{ height: "auto", padding: "8px 12px" }}>
                      <Loader2 size={14} className="bd-spin-icon" />
                      <span>Getting AI transition suggestions…</span>
                    </div>
                  )}

                  {/* REVIEWING */}
                  {phase === "reviewing" && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <p className="bd-eyebrow" style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                        <Sparkles size={12} />
                        AI suggestions · click to override
                      </p>
                      <button
                        type="button"
                        className="bd-btn bd-btn-primary bd-btn-sm"
                        onClick={() => onConfirmCompile(project.id)}
                      >
                        <Check size={14} />
                        Confirm &amp; Compile
                      </button>
                      <button
                        type="button"
                        className="bd-btn bd-btn-ghost bd-btn-sm"
                        onClick={() => onSuggestTransitions(project.id)}
                      >
                        <RefreshCw size={13} />
                        Re-suggest
                      </button>
                    </div>
                  )}

                  {/* COMPILING */}
                  {phase === "compiling" && (
                    <div className="bd-chip p" style={{ height: "auto", padding: "8px 12px" }}>
                      <Loader2 size={14} className="bd-spin-icon" />
                      <span>Stitching with FFmpeg…</span>
                    </div>
                  )}

                  {/* DONE */}
                  {phase === "done" && existingUrl && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div className="bd-chip g" style={{ height: "auto", padding: "8px 12px" }}>
                        <Check size={14} />
                        <span>Compiled successfully!</span>
                      </div>
                      <button
                        type="button"
                        className="bd-btn bd-btn-green bd-btn-sm"
                        onClick={() => handleDownload(existingUrl)}
                      >
                        <Download size={14} />
                        Download Compiled Video
                      </button>
                    </div>
                  )}

                  {/* FAILED */}
                  {phase === "failed" && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <p className="bd-field-err" style={{ margin: 0 }}>
                        {error ?? "Compile failed. Please try again."}
                      </p>
                      <button
                        type="button"
                        className="bd-btn bd-btn-ghost bd-btn-sm"
                        onClick={() => onRetry(project.id)}
                      >
                        <RefreshCw size={14} />
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
                  className="bd-btn bd-btn-ghost bd-btn-sm"
                  onClick={() => handleDownload(existingUrl)}
                >
                  <Download size={14} />
                  Download Compiled
                </button>
              )}
            </div>
          </div>
        )}
      </>
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
    <div className="bd-modal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label="Generate AI clip">
      <div
        className="bd-modal"
        style={{ display: "grid", gap: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3>Generate AI clip</h3>
          <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {loading ? (
          <div style={{ display: "grid", justifyItems: "center", gap: 14, padding: "30px 0" }}>
            <div className="bd-spinner" />
            <p style={{ textAlign: "center", margin: 0 }}>
              AI is generating your clip…<br />
              <span style={{ color: "var(--gray)", fontSize: 13 }}>(this takes 30–60 seconds)</span>
            </p>
          </div>
        ) : (
          <>
            <label className="bd-label">Describe the clip</label>
            <textarea
              className="bd-textarea"
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              rows={3} maxLength={500}
              placeholder="e.g. A product being showcased on a clean white surface with soft lighting…"
            />
            <p className="bd-hint" style={{ margin: 0, textAlign: "right" }}>{prompt.length}/500</p>

            <div style={{ display: "grid", gap: 8 }}>
              <label className="bd-label">
                Reference image <span style={{ color: "var(--gray)", fontWeight: 500 }}>(optional — used as first frame)</span>
              </label>
              <input ref={refImageInputRef} type="file" hidden accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRefImageSelect(f); e.target.value = ""; }}
              />
              {refImagePreview ? (
                <div style={{ position: "relative", width: 120, height: 120, borderRadius: 18, overflow: "hidden", background: "var(--bg)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={refImagePreview} alt="Reference" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {uploadingRef && (
                    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.7)" }}>
                      <Loader2 size={22} className="bd-spin-icon" />
                    </div>
                  )}
                  {!uploadingRef && refImageUrl && (
                    <div className="bd-chip g" style={{ position: "absolute", left: 6, bottom: 6, height: 22, padding: "0 6px" }}>
                      <Check size={12} />
                    </div>
                  )}
                  <button type="button" aria-label="Remove image"
                    style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 8, border: 0, background: "rgba(16,16,17,0.6)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}
                    onClick={() => { setRefImagePreview(null); setRefImageUrl(null); setRefUploadError(null); }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button type="button" className="bd-btn bd-btn-ghost" style={{ justifyContent: "center", height: 64, borderStyle: "dashed" }} onClick={() => refImageInputRef.current?.click()}
                >
                  <ImageIcon size={18} />
                  <span>Upload reference image</span>
                  <span style={{ color: "var(--gray)", fontSize: 12 }}>JPG, PNG</span>
                </button>
              )}
              {refUploadError && <p className="bd-field-err" style={{ margin: 0 }}>{refUploadError}</p>}
            </div>

            <label className="bd-label">Duration</label>
            <div className="bd-seg">
              {([4, 8] as const).map((d) => (
                <button key={d} type="button" className={duration === d ? "is-on" : ""} onClick={() => setDuration(d)}
                >{d}s</button>
              ))}
            </div>
            {error && <p className="bd-field-err" style={{ margin: 0 }}>{error}</p>}
            <button type="button" className="bd-btn bd-btn-primary" style={{ justifyContent: "center" }} onClick={handleGenerate} disabled={!prompt.trim() || uploadingRef}
            >
              <Sparkles size={15} />
              {refImageUrl ? "Generate from Image + Prompt" : "Generate"} (15 credits)
            </button>
          </>
        )}
      </div>
    </div>
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
      <div className="bd-page">
        <div className="bd-card" style={{ maxWidth: 520, margin: "40px auto", padding: 40, textAlign: "center", display: "grid", justifyItems: "center", gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--tint)", color: "var(--p)", display: "grid", placeItems: "center" }}>
            <Film size={28} />
          </div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-d)", fontSize: 28, letterSpacing: "-0.03em" }}>Video Studio</h2>
          <p style={{ margin: 0, color: "var(--gray)", lineHeight: 1.6 }}>
            Video Studio requires a Pro or Business plan. Upgrade to create, generate, and export AI videos.
          </p>
          <a className="bd-btn bd-btn-primary" href="/#pricing">
            <Zap size={15} />
            Upgrade now
          </a>
          <p style={{ margin: 0, color: "var(--gray)", fontSize: 13 }}>
            Starting at ₹999/month · 500 credits included
          </p>
        </div>
      </div>
    );
  }

  const mediaList = activeMediaTab === "my" ? myClips : aiClips;

  return (
    <div className="bd-page">
      <div className="bd-pagehead">
        <div>
          <h1>Video Studio</h1>
          <p>Upload or generate clips, arrange them on the timeline, and export your video.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="bd-dropdown" style={{ minWidth: 220 }}>
            <button type="button" onClick={() => setShowProjectDropdown((v) => !v)}>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{projectTitle}</span>
              <ChevronDown size={16} />
            </button>
            <>
              {showProjectDropdown && projects.length > 0 && (
                <div className="menu">
                  {projects.map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => { loadProject(p); setShowProjectDropdown(false); }}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              )}
            </>
          </div>
          <button type="button" className="bd-btn bd-btn-primary" onClick={handleCreateProject} disabled={creatingProject}>
            {creatingProject ? <Loader2 size={15} className="bd-spin-icon" /> : <Plus size={15} />}
            New project
          </button>
        </div>
      </div>

      <div className="bd-vid">

        {/* ─────────────── LEFT PANEL ─────────────── */}
        <aside className="panel">
          <div className="ph">
            <h2>Media library</h2>
            <div className="bd-tabs3">
              {(["my", "ai", "projects"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeMediaTab === tab ? "is-on" : ""}
                  onClick={() => setActiveMediaTab(tab)}
                >
                  {tab === "my" ? "My clips" : tab === "ai" ? "AI clips" : "Projects"}
                  {tab === "projects" && strategyProjects.length > 0 && (
                    <span className="n">{strategyProjects.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Clip / Project list */}
          <div className="bd-lib">
            {(activeMediaTab === "my" || activeMediaTab === "ai") && (
              <>
                {mediaList.length === 0 ? (
                  <div className="bd-empty" style={{ padding: "26px 8px" }}>
                    <Film size={24} />
                    <strong>
                      {activeMediaTab === "my" ? "No clips uploaded yet" : "No AI clips generated yet"}
                    </strong>
                  </div>
                ) : (
                  mediaList.map((lib) => (
                    <button key={lib.id} type="button" className="bd-libitem" onClick={() => addToTimeline(lib)}
                    >
                      <div
                        className="th"
                        style={lib.thumbnailDataUrl ? { backgroundImage: `url(${lib.thumbnailDataUrl})` } : undefined}
                      />
                      <div className="tx">
                        <b>{lib.title}</b>
                        <span>{formatDuration(lib.duration)}</span>
                      </div>
                      <Plus size={16} />
                    </button>
                  ))
                )}
              </>
            )}

            {activeMediaTab === "projects" && (
              <>
                {loadingStrategyProjects ? (
                  <div className="bd-empty" style={{ padding: "26px 8px" }}>
                    <div className="bd-spinner" />
                    <strong>Loading projects…</strong>
                  </div>
                ) : strategyProjects.length === 0 ? (
                  <div className="bd-empty" style={{ padding: "26px 8px" }}>
                    <Folder size={24} />
                    <strong>No scene projects yet</strong>
                    <span>
                      Generate video scenes from your Strategy page to see them here as compilable folders.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
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
                    <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={loadStrategyProjects}
                    >
                      <RefreshCw size={13} />
                      Refresh
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Upload / Generate — hidden in Projects tab */}
          {activeMediaTab !== "projects" ? (
            <div className="pf">
              <input ref={fileInputRef} type="file" hidden
                accept=".mp4,.mov,.webm,.jpg,.jpeg,.png,video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadClip(f); e.target.value = ""; }}
              />
              <button type="button" className="bd-btn bd-btn-ghost" style={{ justifyContent: "center" }} onClick={() => fileInputRef.current?.click()} disabled={uploadingClip}
              >
                {uploadingClip ? <Loader2 size={15} className="bd-spin-icon" /> : <Upload size={15} />}
                {uploadingClip ? "Uploading…" : "Upload clip"}
              </button>
              {uploadError && <p className="bd-field-err" style={{ margin: 0 }}>{uploadError}</p>}
              <button type="button" className="bd-btn bd-btn-primary" style={{ justifyContent: "center" }} onClick={() => setShowGenerateModal(true)}
              >
                <Sparkles size={15} />
                Generate AI clip
              </button>
            </div>
          ) : (
            <div style={{ height: 14 }} />
          )}
        </aside>

        {/* ─────────────── CENTER — TIMELINE ─────────────── */}
        <div className="panel">
          <div className="ph">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2>Timeline</h2>
              <span className="bd-hint" style={{ margin: 0 }}>
                {timeline.length > 0
                  ? `${timeline.length} clip${timeline.length !== 1 ? "s" : ""} · ${formatDuration(totalDuration)} · drag to reorder`
                  : "Drag clips to reorder"}
              </span>
            </div>
          </div>
          <div className="bd-timeline-wrap">
            {timeline.length === 0 ? (
              <div className="bd-empty" style={{ padding: "40px 12px" }}>
                <Film size={32} />
                <strong>Add clips to get started</strong>
                <span>Upload or generate a clip from the media library</span>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={timeline.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                  <div className="bd-track">
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
            )}
          </div>
        </div>

        {/* ─────────────── RIGHT PANEL ─────────────── */}
        <aside className="right" style={{ display: "grid", gap: 16 }}>
          <div className="panel">
            <div className="ph">
              <h2>Preview</h2>
              <div className="bd-preview">
                <video ref={videoRef} playsInline preload="metadata" />
                {!timeline.length && (
                  <div className="empty">
                    <Video size={30} />
                  </div>
                )}
                {timeline.length > 0 && (
                  <button type="button" className="fs" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} aria-label="Fullscreen" onClick={handleFullscreen}
                  >
                    {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="bd-btn bd-btn-dark" aria-label={isPlaying ? "Pause" : "Play"} onClick={togglePlay} disabled={!timeline.length}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button type="button" className="bd-btn bd-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={startFullPreview} disabled={!timeline.length}
                >
                  Play full preview
                </button>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <p className="bd-eyebrow" style={{ margin: 0 }}>Project</p>
              {editingTitle ? (
                <input type="text" className="bd-input" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)}
                  onBlur={saveTitle} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); }}
                  autoFocus
                />
              ) : (
                <button type="button" className="bd-btn bd-btn-ghost" style={{ justifyContent: "flex-start" }} onClick={() => setEditingTitle(true)} title="Click to rename"
                >
                  {projectTitle}
                </button>
              )}
              <div className="bd-chip" style={{ justifySelf: "start" }}>
                <Clock size={13} />
                {timeline.length} clip{timeline.length !== 1 ? "s" : ""} · {formatDuration(totalDuration)}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <button type="button" className="bd-btn bd-btn-primary" style={{ justifyContent: "center" }} onClick={handleAiRefine} disabled={isRefining || !timeline.length}
              >
                {isRefining ? (
                  <><Loader2 size={15} className="bd-spin-icon" /> AI is analysing your timeline…</>
                ) : (
                  <><Sparkles size={15} /> AI refine</>
                )}
              </button>
              <>
                {showRefinePanel && refineResult && (
                  <div style={{ background: "var(--tint)", borderRadius: 18, padding: 14, display: "grid", gap: 8 }}>
                    <p className="bd-eyebrow" style={{ margin: 0, color: "var(--p)" }}>AI suggestion</p>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{refineResult.summary}</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="bd-btn bd-btn-primary bd-btn-sm" onClick={acceptRefine}
                      >
                        <Check size={14} /> Accept
                      </button>
                      <button type="button" className="bd-btn bd-btn-ghost bd-btn-sm" onClick={() => { setShowRefinePanel(false); setRefineResult(null); }}
                      >
                        <Undo2 size={14} /> Undo
                      </button>
                    </div>
                  </div>
                )}
              </>
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <button type="button" className="bd-btn bd-btn-dark" style={{ justifyContent: "center" }} onClick={handleDownload} disabled={!timeline.length || downloading}
              >
                {downloading ? (
                  <><Loader2 size={16} className="bd-spin-icon" /> Downloading…</>
                ) : (
                  <><Download size={16} /> Download video</>
                )}
              </button>
              {timeline.length > 1 && !downloading && (
                <p className="bd-hint" style={{ margin: 0, textAlign: "center" }}>Downloads the selected clip</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <>
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
      </>

    </div>
  );
}
