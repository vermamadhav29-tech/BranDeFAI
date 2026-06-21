"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import apiClient from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const token = searchParams.get("token");
    const next = searchParams.get("next") ?? "dashboard";

    if (!token) {
      console.error("[auth/callback] no exchange token in URL");
      router.replace("/login?error=google_failed");
      return;
    }

    // POST the exchange token to the backend — this is a direct XHR, same as
    // email/password login, so the Set-Cookie response is stored reliably.
    apiClient
      .post<{
        success: boolean;
        data: { userId: string; email: string; plan: string; creditsBalance: number };
        error: string | null;
      }>("/api/auth/exchange", { token })
      .then((res) => {
        if (res.data.success) {
          const { userId, email, plan, creditsBalance } = res.data.data;
          console.log(`[auth/callback] exchange ok — userId=${userId} plan=${plan}`);
          setUser({ id: userId, email, plan, creditsBalance });
          router.replace(`/${next}`);
        } else {
          router.replace("/login?error=google_failed");
        }
      })
      .catch((err) => {
        console.error("[auth/callback] exchange failed:", err?.response?.data ?? err?.message);
        router.replace("/login?error=google_failed");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A7A4A]" />
        <p className="text-sm text-gray-500 font-medium">Completing sign in…</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-8 h-8 animate-spin text-[#1A7A4A]" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
