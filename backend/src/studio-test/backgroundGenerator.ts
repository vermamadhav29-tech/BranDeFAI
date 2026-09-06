/**
 * backgroundGenerator.ts — live "empty stage" backdrop generation.
 *
 * Unlike backgroundLibrary.ts (which picks from 42 pre-rendered backdrops),
 * this generates a bespoke backdrop from the Art Director's own scene
 * description for THIS product — so a niche category (devotional idols,
 * a specific dessert, an unusual material) gets a backdrop that actually
 * fits, instead of the nearest generic mood.
 *
 * Tradeoff, by design: adds ~15-60s and a Flux cost per post. The caller
 * (studioTest.controller.ts) falls back to the pre-rendered library, then
 * to the blurred-original backdrop, if this fails or times out.
 */

import { SCENE_NEGATIVE } from "./designSystem";

type Logger = (msg: string) => void;

const TIMEOUT_MS = 70_000;

export async function generateLiveBackdrop(sceneDescription: string, log: Logger): Promise<Buffer> {
  const key = process.env.BFL_API_KEY;
  if (!key) throw new Error("BFL_API_KEY not set");

  const prompt =
    `Empty product-photography backdrop: ${sceneDescription}. Cinematic soft studio lighting, ` +
    "gentle vignette, shallow depth of field. Completely empty stage — no objects, no products, " +
    "no props anywhere in the frame. Open, uncluttered area across the centre for a product to be " +
    "placed later. Ultra-realistic, 8k, editorial advertising photography.";

  const t0 = Date.now();
  log(`[backdrop] live — submitting: "${sceneDescription}"`);

  const submitRes = await fetch("https://api.bfl.ai/v1/flux-pro-1.1", {
    method: "POST",
    headers: { "x-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: SCENE_NEGATIVE,
      width: 1024,
      height: 1024,
      output_format: "jpeg",
      safety_tolerance: 2,
    }),
  });
  if (!submitRes.ok) {
    throw new Error(`Flux submit HTTP ${submitRes.status}: ${(await submitRes.text().catch(() => "")).slice(0, 200)}`);
  }

  const submitData = (await submitRes.json()) as { id?: string; polling_url?: string };
  if (!submitData.id) throw new Error("Flux: no job id returned");
  const pollUrl = submitData.polling_url ?? `https://api.bfl.ai/v1/get_result?id=${submitData.id}`;

  while (true) {
    if (Date.now() - t0 > TIMEOUT_MS) throw new Error(`Flux backdrop timed out after ${TIMEOUT_MS / 1000}s`);
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetch(pollUrl, { headers: { "x-key": key } });
    if (!pollRes.ok) throw new Error(`Flux poll HTTP ${pollRes.status}`);
    const d = (await pollRes.json()) as { status: string; result?: { sample?: string } };

    if (d.status === "Ready") {
      const url = d.result?.sample;
      if (!url) throw new Error("Flux: ready but no sample URL");
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error(`Flux: image download HTTP ${imgRes.status}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      log(`[backdrop] live — ready, ${buf.length} bytes, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return buf;
    }
    if (["Error", "Request Moderated", "Content Moderated"].includes(d.status)) {
      throw new Error(`Flux backdrop job failed with status: ${d.status}`);
    }
  }
}
