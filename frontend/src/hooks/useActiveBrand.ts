import { useBrandStore } from "@/stores/brandStore";
import { useWorkspaceStore, PRIMARY_BRAND_ID } from "@/stores/workspaceStore";

export interface BrandOption {
  id: string;
  name: string;
  logoUrl: string | null;
  isPrimary: boolean;
}

// All brands the user can switch between: the account's primary brand first, then extras.
export function useBrandOptions(): { options: BrandOption[]; active: BrandOption | null } {
  const primary = useBrandStore((s) => s.brand);
  const extras = useWorkspaceStore((s) => s.brands);
  const activeId = useWorkspaceStore((s) => s.activeBrandId);

  const options: BrandOption[] = [
    ...(primary ? [{ id: PRIMARY_BRAND_ID, name: primary.brandName, logoUrl: primary.logoUrl, isPrimary: true }] : []),
    ...extras.map((b) => ({ id: b.id, name: b.name, logoUrl: b.logoDataUrl, isPrimary: false })),
  ];
  const active = options.find((o) => o.id === activeId) ?? options[0] ?? null;
  return { options, active };
}
