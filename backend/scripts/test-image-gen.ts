/**
 * Standalone diagnostic — run with:
 *   npx ts-node scripts/test-image-gen.ts
 */
import "dotenv/config";
import OpenAI, { toFile } from "openai";
import type { ImagesResponse } from "openai/resources/images";
import { v2 as cloudinary } from "cloudinary";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryGenerate(model: string, extra: Record<string, any> = {}): Promise<ImagesResponse | null> {
  try {
    // stream: false locks TypeScript into the non-streaming overload → ImagesResponse
    const response = await openai.images.generate({
      stream: false,
      model: model as "gpt-image-1",
      prompt: "A simple red circle on a white background.",
      n: 1,
      size: "1024x1024",
      ...extra,
    });
    return response;
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; error?: { message?: string; code?: string; type?: string } };
    console.error(`  ✗ ${model} FAILED | status=${e.status ?? "n/a"} | ${e.message}`);
    if (e.error) console.error(`     →`, JSON.stringify(e.error));
    return null;
  }
}

async function uploadBuffer(buffer: Buffer): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "brandefai/test", resource_type: "image" },
      (err, result) => {
        if (err) reject(err);
        else if (result) resolve(result.secure_url);
        else reject(new Error("No result"));
      }
    );
    stream.end(buffer);
  });
}

(async () => {
  console.log("=== BranDeFAI Image Generation Diagnostic ===");
  console.log("OPENAI_API_KEY:       ", !!process.env.OPENAI_API_KEY);
  console.log("CLOUDINARY_CLOUD_NAME:", !!process.env.CLOUDINARY_CLOUD_NAME);

  // TEST 1: Cloudinary
  console.log("\n=== TEST 1: Cloudinary credentials ===");
  try {
    const r = await cloudinary.api.ping();
    console.log("✓ Cloudinary ping:", r.status);
  } catch (err: unknown) {
    const e = err as { http_code?: number; message?: string };
    console.error(`✗ Cloudinary FAILED | http_code=${e.http_code} | ${e.message}`);
  }

  // TEST 2: Find working OpenAI image model
  console.log("\n=== TEST 2: OpenAI image model availability ===");

  const candidates = [
    { model: "gpt-image-1",      extra: { quality: "medium" } },
    { model: "gpt-image-1-mini", extra: { quality: "medium" } },
    { model: "dall-e-3",         extra: { quality: "standard", size: "1024x1024" } },
    { model: "dall-e-2",         extra: { size: "512x512" } },
  ];

  let workingModel = "";
  for (const { model, extra } of candidates) {
    console.log(`  Trying ${model}…`);
    const response = await tryGenerate(model, extra);
    if (!response) continue;

    const item = response.data?.[0];
    if (!item) { console.error(`  ✗ ${model} — no data in response`); continue; }

    console.log(`  ✓ ${model} responded | keys: ${Object.keys(item).join(", ")}`);

    // TEST 3: Full pipeline (decode + Cloudinary upload)
    console.log(`\n=== TEST 3: Full pipeline with ${model} ===`);
    let buffer: Buffer | null = null;

    if (item.b64_json) {
      buffer = Buffer.from(item.b64_json, "base64");
      console.log(`  ✓ b64_json decoded | bytes=${buffer.length}`);
    } else if (item.url) {
      const { default: axios } = await import("axios");
      const r = await axios.get<ArrayBuffer>(item.url, { responseType: "arraybuffer", timeout: 30000 });
      buffer = Buffer.from(r.data as ArrayBuffer);
      console.log(`  ✓ URL downloaded | bytes=${buffer.length}`);
    }

    if (!buffer) { console.error(`  ✗ No image data to upload`); continue; }

    try {
      const url = await uploadBuffer(buffer);
      console.log(`  ✓ Cloudinary upload success!`);
      console.log(`  ✓ URL: ${url}`);
      workingModel = model;
      break;
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error(`  ✗ Cloudinary upload failed | ${e.message}`);
    }
  }

  if (workingModel) {
    console.log(`\n✅ WORKING MODEL: "${workingModel}" — update imageGenService.ts to use this`);
  } else {
    console.log(`\n❌ No working model found — check API key tier and billing`);
  }

  console.log("\n=== Done ===");
})();
