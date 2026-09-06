/**
 * One-time background-library generator.
 *
 *   npx ts-node scripts/generateBackgrounds.ts                       # everything (~42 images)
 *   npx ts-node scripts/generateBackgrounds.ts --industry jewellery  # one industry
 *   npx ts-node scripts/generateBackgrounds.ts --industry jewellery --mood royal --per 1
 *   npx ts-node scripts/generateBackgrounds.ts --dry                 # print prompts only
 *
 * Resume-safe: ids already in the manifest are skipped. Manifest is written after every image.
 * Requires BFL_API_KEY + CLOUDINARY_* in backend/.env.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import {
  INDUSTRY_SCENES, scenePrompt, SCENE_NEGATIVE, SCENE_VARIATIONS,
} from "../src/studio-test/designSystem";
import {
  MANIFEST_PATH, type BackgroundManifest, type BackgroundItem, analyseTone,
} from "../src/studio-test/backgroundLibrary";

// ─── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg  = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const ONLY_INDUSTRY = arg("industry");
const ONLY_MOOD     = arg("mood");
const PER           = Number(arg("per") ?? SCENE_VARIATIONS.length);
const DRY           = argv.includes("--dry");

// ─── Flux (BFL) ───────────────────────────────────────────────────────────────
async function generateFlux(prompt: string): Promise<Buffer> {
  const key = process.env.BFL_API_KEY;
  if (!key) throw new Error("BFL_API_KEY not set");

  const submit = await fetch("https://api.bfl.ai/v1/flux-pro-1.1", {
    method: "POST",
    headers: { "x-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: SCENE_NEGATIVE,
      width: 1024, height: 1024,
      output_format: "jpeg",
      safety_tolerance: 2,
    }),
  });
  if (!submit.ok) throw new Error(`Flux submit HTTP ${submit.status}: ${(await submit.text()).slice(0, 200)}`);
  const s = (await submit.json()) as { id?: string; polling_url?: string };
  if (!s.id) throw new Error("Flux: no job id");
  const pollUrl = s.polling_url ?? `https://api.bfl.ai/v1/get_result?id=${s.id}`;

  for (let i = 0; i < 70; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const p = await fetch(pollUrl, { headers: { "x-key": key } });
    if (!p.ok) throw new Error(`Flux poll HTTP ${p.status}`);
    const d = (await p.json()) as { status: string; result?: { sample?: string } };
    if (d.status === "Ready") {
      const url = d.result?.sample;
      if (!url) throw new Error("Flux: no sample url");
      const img = await fetch(url);
      return Buffer.from(await img.arrayBuffer());
    }
    if (["Error", "Request Moderated", "Content Moderated"].includes(d.status)) {
      throw new Error(`Flux status ${d.status}`);
    }
  }
  throw new Error("Flux: timeout");
}

// ─── Cloudinary ───────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function upload(buf: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "brandefai/backgrounds", public_id: publicId, resource_type: "image", overwrite: true },
      (err, res) => (err || !res ? reject(err ?? new Error("no result")) : resolve(res.secure_url)),
    );
    stream.end(buf);
  });
}

// ─── manifest ─────────────────────────────────────────────────────────────────
function readManifest(): BackgroundManifest {
  try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")); }
  catch { return { generatedAt: new Date().toISOString(), items: [] }; }
}
function writeManifest(m: BackgroundManifest) {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  m.generatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
}

// ─── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const manifest = readManifest();
  const have = new Set(manifest.items.map((i) => i.id));
  let made = 0, failed = 0;

  for (const [industry, moods] of Object.entries(INDUSTRY_SCENES)) {
    if (ONLY_INDUSTRY && industry !== ONLY_INDUSTRY) continue;
    for (const [mood, scene] of Object.entries(moods)) {
      if (ONLY_MOOD && mood !== ONLY_MOOD) continue;
      for (let v = 0; v < PER; v++) {
        const id = `${industry}_${mood}_${String(v + 1).padStart(2, "0")}`;
        if (have.has(id)) { console.log(`skip  ${id}`); continue; }

        const prompt = scenePrompt(scene, SCENE_VARIATIONS[v % SCENE_VARIATIONS.length]);
        if (DRY) { console.log(`\n${id}\n  ${prompt}`); continue; }

        try {
          console.log(`gen   ${id} …`);
          const buf  = await generateFlux(prompt);
          const url  = await upload(buf, id);
          const tone = await analyseTone(buf);
          const item: BackgroundItem = { id, industry, mood, url, ...tone };
          manifest.items.push(item);
          writeManifest(manifest);
          console.log(`ok    ${id}  ${tone.tone}  ${tone.dominant}  ${url}`);
          made++;
        } catch (e) {
          console.log(`FAIL  ${id}: ${e instanceof Error ? e.message : e}`);
          failed++;
        }
      }
    }
  }
  console.log(`\n${made} generated, ${failed} failed, ${manifest.items.length} total in manifest`);
})();
