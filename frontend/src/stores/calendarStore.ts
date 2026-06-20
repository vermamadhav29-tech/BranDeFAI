import { create } from "zustand";

export type ContentType = "CAPTION" | "REEL_IDEA" | "AD_COPY" | "IMAGE" | "VIDEO";
export type EntryStatus = "SCHEDULED" | "PUBLISHED" | "SKIPPED";

export interface CalendarEntry {
  id: string;
  calendarDay: number;
  month: number;
  year: number;
  contentType: ContentType;
  contentId: string;
  notes: string | null;
  status: EntryStatus;
  preview: unknown;
  hashtags: string[];
  keywords: string[];
  suggestedTime: string | null;
  assetUrl: string | null;
}

interface CalendarStore {
  entries: CalendarEntry[];
  month: number;
  year: number;
  setEntries: (entries: CalendarEntry[]) => void;
  setMonth: (month: number) => void;
  setYear: (year: number) => void;
  upsertEntry: (entry: CalendarEntry) => void;
  removeEntry: (id: string) => void;
}

const now = new Date();

export const useCalendarStore = create<CalendarStore>((set) => ({
  entries: [],
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  setEntries: (entries) => set({ entries }),
  setMonth: (month) => set({ month }),
  setYear: (year) => set({ year }),
  upsertEntry: (entry) =>
    set((s) => ({
      entries: s.entries.some((e) => e.id === entry.id)
        ? s.entries.map((e) => (e.id === entry.id ? entry : e))
        : [...s.entries, entry],
    })),
  removeEntry: (id) =>
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
}));
