/**
 * logoVision.ts — one cheap GPT-4o vision check on the logo, replacing pixel
 * heuristics that kept getting fooled (e.g. a rounded-corner colour-card logo
 * has just enough incidental transparency at the corners to look like a
 * "transparent, fine as-is" PNG even though it has a solid fill and baked-in
 * text). Runs in parallel with the ~85s Stage 1/2 creative pipeline, so it
 * costs nothing in wall-clock time.
 */

type Logger = (msg: string) => void;

export interface LogoHint {
  hasBakedInText: boolean;
  backgroundStyle: "transparent" | "flat_color" | "complex";
}

const TIMEOUT_MS = 20_000;

const SYSTEM = `You are analysing a brand logo image. Look carefully at the actual pixels, not just the
overall shape, and answer with ONLY valid JSON:
{
  "hasBakedInText": true|false,
  "backgroundStyle": "transparent"|"flat_color"|"complex"
}

hasBakedInText: true if the brand name or a tagline is already visible as legible text within the image
itself (this includes text on a coloured card/tile, not just text on a transparent background).

backgroundStyle:
  "transparent" — the mark has no background fill at all (works when placed on any colour)
  "flat_color"  — the mark sits on a single solid or near-solid colour fill (including a rounded-corner
                  coloured card/tile) that could be cleanly keyed out to leave just the mark
  "complex"     — a photograph, gradient, pattern, or anything that can't be cleanly keyed`;

export async function inspectLogo(logoUrl: string, log: Logger): Promise<LogoHint | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    log("[logo] asking GPT-4o about background style / baked-in text...");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        max_tokens: 100,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: [{ type: "image_url", image_url: { url: logoUrl, detail: "low" } }] },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) { log(`[logo] HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 150)}`); return null; }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) { log("[logo] empty response"); return null; }

    const raw = JSON.parse(content) as Record<string, unknown>;
    const bg  = raw.backgroundStyle;
    const backgroundStyle: LogoHint["backgroundStyle"] =
      bg === "transparent" || bg === "flat_color" || bg === "complex" ? bg : "complex";
    const hint: LogoHint = { hasBakedInText: raw.hasBakedInText === true, backgroundStyle };
    log(`[logo] hint — hasBakedInText=${hint.hasBakedInText} backgroundStyle=${hint.backgroundStyle}`);
    return hint;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    log(`[logo] inspect failed: ${isTimeout ? "timed out" : err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
