import apiClient from "@/lib/apiClient";
import { useState } from "react";

export function useApi<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(method: "get" | "post" | "put" | "delete", url: string, data?: unknown): Promise<T | null> {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient[method]<{ success: boolean; data: T; error: string | null }>(url, data);
      return res.data.data;
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Something went wrong";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { request, loading, error };
}
