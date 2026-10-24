"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import apiClient from "@/lib/apiClient";
import { clearOfflineBrand, isUnreachable } from "@/lib/offlineBrand";
import { useBrandStore } from "@/stores/brandStore";
import { useWorkspaceStore, PRIMARY_BRAND_ID } from "@/stores/workspaceStore";

export function DeleteCompanyModal({ name, busy, error, onCancel, onConfirm }: { name: string; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const phrase = `delete ${name.trim()}`;
  const ok = typed.trim().toLowerCase() === phrase.toLowerCase();
  if (!mounted) return null;
  // rendered at the app root so no parent card can trap or overlap it
  return createPortal(
    <div className="bd-modal-bg" onClick={busy ? undefined : onCancel} role="dialog" aria-modal="true" aria-label={`Delete ${name}`}>
      <div className="bd-modal" style={{ display: "grid", gap: 14 }} onClick={(e) => e.stopPropagation()}>
        <h3>Delete {name}?</h3>
        <p className="bd-card-sub" style={{ margin: 0 }}>
          This permanently removes the company and everything made for it: generated content, images, videos and calendar entries. This can&apos;t be undone.
        </p>
        <div className="bd-field">
          <label className="bd-label" htmlFor="del-confirm">Type <b>{phrase}</b> to confirm</label>
          <input id="del-confirm" className="bd-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
        </div>
        {error && <p className="bd-field-err" style={{ margin: 0 }} role="alert">{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="bd-btn bd-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="bd-btn bd-btn-primary" onClick={onConfirm} disabled={!ok || busy}>{busy ? "Deleting…" : "Delete company"}</button>
        </div>
      </div>
    </div>,
    document.querySelector(".bd-app") ?? document.body,
  );
}

/** Deletes the account's main brand, then sends the user to onboarding (or Companies if they have others). */
export function useDeleteMainBrand() {
  const router = useRouter();
  const brand = useBrandStore((s) => s.brand);
  const clearBrand = useBrandStore((s) => s.clearBrand);
  const extras = useWorkspaceStore((s) => s.brands);
  const setActive = useWorkspaceStore((s) => s.setActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      if (!brand?.id.startsWith("local-")) {
        try {
          await apiClient.delete("/api/brand");
        } catch (err) {
          if (isUnreachable(err)) {
            setError("Couldn't reach the server, so nothing was deleted. Check your connection and try again.");
            return false;
          }
          throw err;
        }
      }
      clearOfflineBrand();
      clearBrand();
      setActive(PRIMARY_BRAND_ID);
      toast.success("Company deleted.");
      router.push(extras.length ? "/companies" : "/brand-setup");
      return true;
    } catch {
      setError("That company couldn't be deleted. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, reset: () => setError(null), run };
}
