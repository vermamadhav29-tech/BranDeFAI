import { create } from "zustand";
import { persist } from "zustand/middleware";

// Extra companies/brands beyond the account's primary brand.
// The primary brand lives on the server (/api/brand). Additional brands are kept in this
// browser until the backend supports more than one brand per user.
export interface WorkspaceBrand {
  id: string;
  name: string;
  website: string;
  lore: string; // the brand story
  context: string; // audience, positioning, anything the AI should know
  services: string; // what they sell / offer
  logoDataUrl: string | null;
  colors: { primary: string; secondary: string; accent: string };
  createdAt: string;
}

export const PRIMARY_BRAND_ID = "primary";

// How many brands each plan can have (primary included). Placeholder limits.
export const BRAND_LIMIT: Record<string, number> = { FREE: 1, PRO: 3, BUSINESS: 10 };

interface WorkspaceStore {
  brands: WorkspaceBrand[];
  activeBrandId: string;
  addBrand: (b: Omit<WorkspaceBrand, "id" | "createdAt">) => WorkspaceBrand;
  updateBrand: (id: string, patch: Partial<Omit<WorkspaceBrand, "id" | "createdAt">>) => void;
  removeBrand: (id: string) => void;
  setActive: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      brands: [],
      activeBrandId: PRIMARY_BRAND_ID,
      addBrand: (b) => {
        const brand: WorkspaceBrand = {
          ...b,
          id: typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ brands: [...s.brands, brand], activeBrandId: brand.id }));
        return brand;
      },
      updateBrand: (id, patch) => set((s) => ({ brands: s.brands.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      removeBrand: (id) =>
        set((s) => ({
          brands: s.brands.filter((x) => x.id !== id),
          activeBrandId: s.activeBrandId === id ? PRIMARY_BRAND_ID : s.activeBrandId,
        })),
      setActive: (id) => set({ activeBrandId: id }),
    }),
    { name: "bd-workspace" },
  ),
);
