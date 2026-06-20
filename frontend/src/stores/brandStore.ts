import { create } from "zustand";
import type { Brand } from "@/types";

interface BrandStore {
  brand: Brand | null;
  setBrand: (brand: Brand) => void;
  clearBrand: () => void;
}

export const useBrandStore = create<BrandStore>((set) => ({
  brand: null,
  setBrand: (brand) => set({ brand }),
  clearBrand: () => set({ brand: null }),
}));
