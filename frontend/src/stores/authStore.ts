import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  plan: string;
  creditsBalance: number;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  updateCredits: (balance: number) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
  setLoading: (isLoading) => set({ isLoading }),
  updateCredits: (balance) => {
    const { user } = get();
    if (!user || user.creditsBalance === balance) return;
    set({ user: { ...user, creditsBalance: balance } });
  },
}));
