import { create } from "zustand";

interface Brand {
  id: string;
  name: string;
  niche: string;
  tone: string;
  logoUrl?: string;
}

interface BrandStore {
  brand: Brand | null;
  setBrand: (brand: Brand | null) => void;
}

export const useBrandStore = create<BrandStore>((set) => ({
  brand: null,
  setBrand: (brand) => set({ brand }),
}));
