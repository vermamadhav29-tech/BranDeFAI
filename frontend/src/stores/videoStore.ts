import { create } from "zustand";

export type TransitionType = "none" | "crossfade" | "wipe-left" | "wipe-right";

export interface TimelineClip {
  id: string;
  sourceUrl: string;
  title: string;
  duration: number;
  thumbnailDataUrl: string | null;
  transitionType: TransitionType;
  source: "uploaded" | "ai";
}

interface VideoStore {
  currentProjectId: string | null;
  timeline: TimelineClip[];
  selectedClipId: string | null;
  isExporting: boolean;
  exportUrl: string | null;
  isRefining: boolean;

  setProject: (id: string | null) => void;
  setTimeline: (clips: TimelineClip[]) => void;
  addClipToTimeline: (clip: TimelineClip) => void;
  removeClipFromTimeline: (id: string) => void;
  setSelectedClip: (id: string | null) => void;
  setExporting: (v: boolean) => void;
  setExportUrl: (url: string | null) => void;
  setRefining: (v: boolean) => void;
  updateClipTransition: (clipId: string, t: TransitionType) => void;
  updateClipDuration: (clipId: string, duration: number) => void;
  setClipThumbnail: (clipId: string, dataUrl: string) => void;
}

export const useVideoStore = create<VideoStore>((set) => ({
  currentProjectId: null,
  timeline: [],
  selectedClipId: null,
  isExporting: false,
  exportUrl: null,
  isRefining: false,

  setProject: (id) =>
    set({ currentProjectId: id, timeline: [], selectedClipId: null, isExporting: false, exportUrl: null }),

  setTimeline: (clips) => set({ timeline: clips }),

  addClipToTimeline: (clip) =>
    set((s) => ({ timeline: [...s.timeline, clip] })),

  removeClipFromTimeline: (id) =>
    set((s) => ({
      timeline: s.timeline.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
    })),

  setSelectedClip: (id) => set({ selectedClipId: id }),
  setExporting: (v) => set({ isExporting: v }),
  setExportUrl: (url) => set({ exportUrl: url }),
  setRefining: (v) => set({ isRefining: v }),

  updateClipTransition: (clipId, t) =>
    set((s) => ({
      timeline: s.timeline.map((c) => (c.id === clipId ? { ...c, transitionType: t } : c)),
    })),

  updateClipDuration: (clipId, duration) =>
    set((s) => ({
      timeline: s.timeline.map((c) => (c.id === clipId ? { ...c, duration } : c)),
    })),

  setClipThumbnail: (clipId, dataUrl) =>
    set((s) => ({
      timeline: s.timeline.map((c) => (c.id === clipId ? { ...c, thumbnailDataUrl: dataUrl } : c)),
    })),
}));
