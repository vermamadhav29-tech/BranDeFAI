import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  timeout: 120_000, // 120s — content generation runs gpt-image-1 which can take 30-60s total
});

// Pages where a 401 must NOT trigger a redirect to /login.
// /callback is critical: it's mid-OAuth exchange and the hard-nav would abort the in-flight POST.
const PUBLIC_PATHS = ["/", "/pricing", "/callback"];

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login") &&
      !PUBLIC_PATHS.includes(window.location.pathname)
    ) {
      // Race guard: /api/auth/me is fired on /callback BEFORE the exchange cookie is set.
      // If that stale 401 response arrives after router.replace("/brand-setup"), the user
      // is already authenticated (exchange completed). Bouncing to /login here would undo it.
      const url: string = error.config?.url ?? "";
      const isStaleAuthMe =
        url.includes("/auth/me") && useAuthStore.getState().isAuthenticated;
      if (!isStaleAuthMe) {
        console.warn("[apiClient] 401 on", url, "→ redirecting to /login");
        window.location.href = "/login";
      } else {
        console.warn("[apiClient] 401 on stale /auth/me suppressed — exchange already authenticated");
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
