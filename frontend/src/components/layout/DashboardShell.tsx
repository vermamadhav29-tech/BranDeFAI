"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import "@/styles/draftr-fonts.css";
import "@/styles/app.css";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useAuthStore } from "@/stores/authStore";
import { useBrandStore } from "@/stores/brandStore";
import { loadOfflineBrand } from "@/lib/offlineBrand";
import apiClient from "@/lib/apiClient";
import type { Brand } from "@/types";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isCollapsed, isMobileOpen, closeMobile } = useSidebarStore();
  const updateCredits = useAuthStore((s) => s.updateCredits);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const brand = useBrandStore((s) => s.brand);
  const setBrand = useBrandStore((s) => s.setBrand);

  // Centralized route guard for all dashboard routes.
  // Waits for auth to fully settle before acting — prevents the transient
  // { isLoading: false, isAuthenticated: false } window from bouncing logged-in users.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch fresh credit balance
    apiClient
      .get<{ success: boolean; data: { creditsBalance: number; plan: string } }>("/api/credits/balance")
      .then((r) => {
        if (r.data.success) updateCredits(r.data.data.creditsBalance);
      })
      .catch(() => {});

    // Fetch brand if not already in store
    if (!brand) {
      apiClient
        .get<{ success: boolean; data: Brand }>("/api/brand")
        .then((r) => {
          if (r.data.success && r.data.data) setBrand(r.data.data);
        })
        .catch(() => {
          const local = loadOfflineBrand();
          if (local) setBrand(local);
        });
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hold the shell back until we know who the user is (avoids a flash of the app before a redirect).
  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="bd-app">
        <div className="bd-boot" role="status" aria-label="Loading">
          <div className="bd-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="bd-app" data-collapsed={isCollapsed}>
      {isMobileOpen && <div className="bd-overlay" onClick={closeMobile} aria-hidden />}
      {children}
    </div>
  );
}
