"use client";

import { useEffect } from "react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useAuthStore } from "@/stores/authStore";
import { useBrandStore } from "@/stores/brandStore";
import apiClient from "@/lib/apiClient";
import type { Brand } from "@/types";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isMobileOpen, closeMobile } = useSidebarStore();
  const updateCredits = useAuthStore((s) => s.updateCredits);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const brand = useBrandStore((s) => s.brand);
  const setBrand = useBrandStore((s) => s.setBrand);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch fresh credit balance
    apiClient
      .get<{ success: boolean; data: { balance: number; plan: string } }>("/api/credits/balance")
      .then((r) => {
        if (r.data.success) updateCredits(r.data.data.balance);
      })
      .catch(() => {});

    // Fetch brand if not already in store
    if (!brand) {
      apiClient
        .get<{ success: boolean; data: Brand }>("/api/brand")
        .then((r) => {
          if (r.data.success && r.data.data) setBrand(r.data.data);
        })
        .catch(() => {});
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}
      {children}
    </>
  );
}
