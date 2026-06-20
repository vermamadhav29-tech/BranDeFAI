import { create } from "zustand";

interface SidebarStore {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapse: () => void;
  openMobile: () => void;
  closeMobile: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isCollapsed: false,
  isMobileOpen: false,
  setCollapsed: (v) => set({ isCollapsed: v }),
  toggleCollapse: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
  openMobile: () => set({ isMobileOpen: true }),
  closeMobile: () => set({ isMobileOpen: false }),
}));
