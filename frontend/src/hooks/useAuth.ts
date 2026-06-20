import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/apiClient";
import type { User } from "@/types";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const updateCredits = useAuthStore((s) => s.updateCredits);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    apiClient
      .get<{ success: boolean; data: User; error: string | null }>("/api/auth/me", {
        signal: controller.signal,
      })
      .then((res) => {
        console.log("[useAuth] /api/auth/me response:", res.data);
        if (res.data.success && res.data.data) {
          const userData = res.data.data;
          console.log(`[useAuth] setting user — id=${userData.id} plan=${userData.plan} creditsBalance=${userData.creditsBalance}`);
          setUser(userData);
        } else {
          console.warn("[useAuth] /api/auth/me returned success=false, clearing user");
          clearUser();
        }
      })
      .catch((err) => {
        if (err?.code !== "ERR_CANCELED") {
          console.warn("[useAuth] /api/auth/me failed:", err?.message ?? err);
          clearUser();
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []); // run exactly once on mount

  // Refresh credits balance in background whenever the window regains focus
  useEffect(() => {
    function onFocus() {
      if (!useAuthStore.getState().isAuthenticated) return;
      apiClient
        .get<{ success: boolean; data: { creditsBalance: number; plan: string; planMax: number } }>("/api/credits/balance")
        .then((res) => {
          if (res.data.success && res.data.data) {
            const { creditsBalance } = res.data.data;
            console.log(`[useAuth] focus-refresh creditsBalance=${creditsBalance}`);
            updateCredits(creditsBalance);
          }
        })
        .catch(() => { /* non-critical, ignore */ });
    }

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [updateCredits]);

  return { user, isAuthenticated, isLoading };
}
