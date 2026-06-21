import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  timeout: 120_000, // 120s — content generation runs gpt-image-1 which can take 30-60s total
});

// Pages where a 401 on /api/auth/me must NOT trigger a redirect to /login.
// /callback is critical: it's mid-OAuth exchange, and the hard-nav would abort the in-flight POST.
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
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
