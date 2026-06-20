import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import { createError } from "../../middleware/errorHandler";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 36; // 6 minutes max

function getApiKey(): string {
  const raw = process.env.RUNWAY_API_KEY ?? "";
  return raw.trim();
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "X-Runway-Version": RUNWAY_VERSION,
    "Content-Type": "application/json",
  };
}

function uploadVideoToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "brandefai/clips", resource_type: "video", public_id: publicId },
      (err, result) => {
        if (err || !result) reject(err ?? new Error("Cloudinary upload failed"));
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function generateClip(
  prompt: string,
  duration: number = 4,
  imageUrl?: string
): Promise<string> {
  const apiKey = getApiKey();
  console.log(
    `[runway] API key check | first10="${apiKey.slice(0, 10)}" | totalLength=${apiKey.length} | hasKey=${apiKey.length > 0}`
  );

  if (!apiKey) {
    throw createError("RUNWAY_API_KEY is not set", 500);
  }

  // RunwayML Gen-3 turbo only accepts 5 or 10 seconds
  const safeDuration = duration <= 5 ? 5 : 10;

  const body: Record<string, unknown> = {
    model: "gen3a_turbo",
    promptText: prompt,
    duration: safeDuration,
    ratio: "768:1280",
  };
  if (imageUrl) {
    body.promptImage = imageUrl;
  }

  console.log(
    `[runway] Creating task | duration=${safeDuration}s | hasImage=${!!imageUrl} | endpoint=${RUNWAY_BASE}/image_to_video`
  );
  console.log(`[runway] Request body: ${JSON.stringify({ ...body, promptText: prompt.slice(0, 80) })}`);

  let task: { id?: string };
  try {
    const res = await axios.post(`${RUNWAY_BASE}/image_to_video`, body, { headers: headers() });
    task = res.data;
  } catch (err: unknown) {
    const axErr = err as { response?: { status?: number; data?: unknown }; message?: string };
    console.error(
      `[runway] Task creation failed | status=${axErr.response?.status} | body=${JSON.stringify(axErr.response?.data)} | message=${axErr.message}`
    );
    throw createError(
      `Runway API error ${axErr.response?.status ?? "unknown"}: ${JSON.stringify(axErr.response?.data ?? axErr.message)}`,
      502
    );
  }

  const taskId = task.id;
  if (!taskId) throw createError("Runway did not return a task ID", 502);
  console.log(`[runway] Task created | id=${taskId}`);

  let clipUrl: string | null = null;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let status: { status: string; output?: unknown; failure?: string; failureCode?: string };
    try {
      const res = await axios.get(`${RUNWAY_BASE}/tasks/${taskId}`, { headers: headers() });
      status = res.data;
    } catch (pollErr: unknown) {
      const axErr = pollErr as { response?: { status?: number; data?: unknown }; message?: string };
      console.error(
        `[runway] Poll error | status=${axErr.response?.status} | body=${JSON.stringify(axErr.response?.data)}`
      );
      throw createError(
        `Runway poll error ${axErr.response?.status ?? "unknown"}: ${JSON.stringify(axErr.response?.data ?? axErr.message)}`,
        502
      );
    }

    console.log(`[runway] Poll ${i + 1}/${MAX_POLLS} | status=${status.status}`);

    if (status.status === "SUCCEEDED") {
      const output = status.output;
      clipUrl = Array.isArray(output) ? (output[0] as string) : (output as string);
      break;
    }

    if (status.status === "FAILED") {
      throw createError(
        `Runway generation failed: ${status.failure ?? status.failureCode ?? "unknown"}`,
        502
      );
    }
  }

  if (!clipUrl) throw createError("Runway task timed out after 6 minutes", 504);
  console.log(`[runway] Task succeeded | runway_url=${clipUrl}`);

  // Download the generated video into memory
  const download = await axios.get<ArrayBuffer>(clipUrl, {
    responseType: "arraybuffer",
    timeout: 120_000,
  });
  const videoBuffer = Buffer.from(download.data);

  // Upload directly to Cloudinary (no S3, no temp files)
  const cloudUrl = await uploadVideoToCloudinary(videoBuffer, `runway_${taskId}`);
  console.log(`[runway] Clip stored | cloudinary=${cloudUrl}`);

  return cloudUrl;
}
