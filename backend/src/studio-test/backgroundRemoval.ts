/**
 * backgroundRemoval.ts
 *
 * Self-contained BiRefNet background removal client for the studio-test module.
 * Imports NOTHING from the existing pipeline.
 *
 * Model: men1scus/birefnet (Bilateral Reference for High-Resolution
 *        Dichotomous Image Segmentation, CAAI AIR '24)
 * Version: f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7
 * API ref: https://replicate.com/men1scus/birefnet
 *
 * Input:  Cloudinary URL of the product photo
 * Output: PNG Buffer with alpha transparency (transparent background)
 */

import sharp from "sharp";

type Logger = (msg: string) => void;

// Pinned to the latest version as of lookup date — update when Replicate
// releases a newer version of men1scus/birefnet.
const BIREFNET_VERSION =
  "f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7";

const TIMEOUT_MS = 60_000; // 60 s hard cap

type Prediction = {
  id: string;
  status: string;
  urls?: { get: string };
  output?: string | null;  // single URI string for this model
  error?: string;
};

// Retries a POST up to 2 times on HTTP 429, honouring Replicate's retry_after.
// Returns the Response for any non-429 status so existing error handling is
// unchanged. Throws (→ fallback) only when retries are exhausted.
async function submitWithRetry429(
  url: string,
  init: RequestInit,
  log: Logger,
  tag: string,
): Promise<Response> {
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;

    let waitSec = 5;
    try {
      const body = (await res.json()) as { retry_after?: number };
      if (typeof body.retry_after === "number") waitSec = body.retry_after;
    } catch (_e) {
      // body not JSON or no retry_after field — keep 5s default
    }

    if (attempt === MAX_RETRIES) {
      throw new Error(
        `${tag} HTTP 429 — rate-limited, ${MAX_RETRIES} retries exhausted`,
      );
    }
    const delay = waitSec + 0.5;
    log(
      `${tag} HTTP 429 — retry ${attempt + 1}/${MAX_RETRIES} in ${delay}s (retry_after=${waitSec}s)`,
    );
    await new Promise((r) => setTimeout(r, delay * 1_000));
  }
  throw new Error(`${tag} submitWithRetry429: unreachable`);
}

export async function removeBackground(
  imageUrl: string,
  log: Logger,
): Promise<Buffer> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not set");

  const t0 = Date.now();
  log(
    `[bgremoval] submitting to BiRefNet (men1scus/birefnet v${BIREFNET_VERSION.slice(0, 8)}…)`,
  );

  const createRes = await submitWithRetry429(
    "https://api.replicate.com/v1/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=5",
      },
      body: JSON.stringify({
        version: BIREFNET_VERSION,
        input: { image: imageUrl },
      }),
    },
    log,
    "[bgremoval]",
  );

  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => "");
    throw new Error(
      `BiRefNet submit HTTP ${createRes.status}: ${txt.slice(0, 300)}`,
    );
  }

  let prediction = (await createRes.json()) as Prediction;
  log(
    `[bgremoval] prediction id=${prediction.id} initial status=${prediction.status}`,
  );

  const pollUrl =
    prediction.urls?.get ??
    `https://api.replicate.com/v1/predictions/${prediction.id}`;

  // Poll until succeeded/failed/timeout
  for (let attempt = 1; attempt <= 30; attempt++) {
    if (prediction.status === "succeeded") break;

    if (
      prediction.status === "failed" ||
      prediction.status === "canceled"
    ) {
      throw new Error(
        `BiRefNet prediction ${prediction.status}: ${prediction.error ?? "unknown"}`,
      );
    }

    const elapsed = Date.now() - t0;
    if (elapsed > TIMEOUT_MS) {
      throw new Error(
        `BiRefNet timed out after ${(elapsed / 1000).toFixed(1)}s`,
      );
    }

    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pollRes.ok)
      throw new Error(`BiRefNet poll HTTP ${pollRes.status}`);

    prediction = (await pollRes.json()) as Prediction;
    log(
      `[bgremoval] attempt=${attempt} status=${prediction.status} elapsed=${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }

  if (prediction.status !== "succeeded") {
    throw new Error("BiRefNet: timed out waiting for result");
  }

  // Output for men1scus/birefnet is a single URI string (not an array)
  const outputUrl = prediction.output;
  if (!outputUrl || typeof outputUrl !== "string") {
    throw new Error(
      `BiRefNet: unexpected output shape — ${JSON.stringify(outputUrl)}`,
    );
  }

  log(`[bgremoval] downloading transparent PNG from ${outputUrl}`);
  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok)
    throw new Error(`BiRefNet download HTTP ${imgRes.status}`);

  const rawBuf = Buffer.from(await imgRes.arrayBuffer());

  // Guarantee RGBA PNG regardless of what the model emits
  const pngBuf = await sharp(rawBuf).ensureAlpha().png().toBuffer();

  const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log(
    `[bgremoval] done — ${pngBuf.length} bytes RGBA PNG, total elapsed=${totalElapsed}s`,
  );

  return pngBuf;
}
