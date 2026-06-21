import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  timeout: 120_000, // 120s — content generation runs gpt-image-1 which can take 30-60s total
});

// 401s are handled by each caller or by the centralized route guard in DashboardShell /
// brand-setup. The interceptor must NEVER navigate — a background data fetch returning 401
// should never silently log the user out or abort an in-flight OAuth exchange.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default apiClient;
