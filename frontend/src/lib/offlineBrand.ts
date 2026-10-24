import type { Brand } from "@/types";

// Onboarding keeps working when the API can't be reached: AI text falls back to local
// templates, logos stay in the browser, and the finished brand is cached locally.

const KEY = "bd-offline-brand";

/** True when the request never got an answer (network down / server unreachable / 5xx). */
export function isUnreachable(err: unknown): boolean {
  const e = err as { response?: { status?: number } };
  return !e?.response || (e.response.status ?? 0) >= 500;
}

export function saveOfflineBrand(b: Brand) {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* storage unavailable */ }
}

export function clearOfflineBrand() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function loadOfflineBrand(): Brand | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Brand) : null;
  } catch {
    return null;
  }
}

interface Ctx { brandName: string; industry: string; tone: string; platforms: string[] }

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

export function fallbackText(field: "targetAudience" | "brandBrief", c: Ctx, draft?: string): string {
  const d = (draft ?? "").trim();
  if (d) {
    // expand what the owner wrote with the context we already know
    const industry = c.industry.toLowerCase();
    const where = c.platforms.filter((p) => p !== "Other").slice(0, 3);
    const base = /[.!?]$/.test(d) ? d : d + ".";
    const extra =
      field === "targetAudience"
        ? ` They discover ${industry} brands on social media, value trust and clear pricing, and want a brand that feels personal${where.length ? `, buying through ${list(where)}` : ""}.`
        : ` The brand speaks in a ${c.tone.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).join(", ")} voice and keeps its content honest, specific and consistent across ${where.length ? list(where) : "every channel"}.`;
    return (base + extra).slice(0, field === "targetAudience" ? 400 : 500);
  }
  const name = c.brandName || "Your brand";
  const industry = c.industry.toLowerCase();
  const tones = c.tone.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const where = c.platforms.filter((p) => p !== "Other").slice(0, 3);
  if (field === "targetAudience") {
    return (
      `Style-conscious shoppers across India aged 22–40 who care about quality and discover ${industry} brands on social media. ` +
      `They value trust, clear pricing and a brand that feels personal${where.length ? `, and they buy through ${list(where)}` : ""}.`
    ).slice(0, 400);
  }
  return (
    `${name} is a ${industry} brand with a ${list(tones) || "friendly"} voice. ` +
    `We make ${industry} that people are proud to own, and we talk to our customers like people, not numbers. ` +
    `Our content is honest, specific and consistent, so every post sounds like ${name}.`
  ).slice(0, 500);
}

/** Resize an image to at most 256px and return it as a data URL (so it can live in the browser). */
export function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => resolve(reader.result as string);
      img.onload = () => {
        const scale = Math.min(1, 256 / Math.max(img.width, img.height, 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
