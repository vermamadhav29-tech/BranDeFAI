import { Worker, Job } from "bullmq";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import { VideoStatus, CreditType } from "@prisma/client";
import prisma from "../utils/prisma";
import { deductCredits } from "../utils/creditUtils";
import { uploadToS3 } from "../utils/s3Service";
import { redisConnection } from "./queueConfig";
import type { TimelineClip } from "../services/videoService";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface VideoExportJob {
  projectId: string;
  userId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function downloadClip(url: string, dest: string): Promise<void> {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 60_000 });
  await fs.promises.writeFile(dest, Buffer.from(res.data as ArrayBuffer));
}

function runFfmpeg(command: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .on("start", (cmd) => console.log(`[videoWorker] FFmpeg: ${cmd}`))
      .on("error", (err) => reject(err))
      .on("end", () => resolve());
  });
}

/**
 * Build the -filter_complex string for N clips.
 * All clips are scaled/padded to 1080x1920.
 * If hasTransitions: clips are joined with xfade crossfade (0.5 s).
 * Otherwise:         clips are joined with the concat filter (hard cut).
 */
function buildFilterComplex(
  clips: TimelineClip[],
  hasTransitions: boolean
): { filterStr: string; outputLabel: string } {
  const SCALE =
    "scale=1080:1920:force_original_aspect_ratio=decrease," +
    "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black";

  const parts: string[] = [];
  const XFADE_DUR = 0.5;

  // Scale each input
  for (let i = 0; i < clips.length; i++) {
    parts.push(`[${i}:v]${SCALE}[s${i}]`);
  }

  if (clips.length === 1) {
    return { filterStr: parts.join(";"), outputLabel: "s0" };
  }

  if (!hasTransitions) {
    // concat filter — hard cuts
    const inputs = clips.map((_, i) => `[s${i}]`).join("");
    parts.push(`${inputs}concat=n=${clips.length}:v=1:a=0[vout]`);
    return { filterStr: parts.join(";"), outputLabel: "vout" };
  }

  // xfade chain — cross-dissolve between every adjacent pair
  let prevLabel = "s0";
  let prevOutDuration = clips[0].duration;

  for (let i = 1; i < clips.length; i++) {
    const outLabel = i === clips.length - 1 ? "vout" : `x${i}`;
    const offset = Math.max(0, prevOutDuration - XFADE_DUR);
    parts.push(
      `[${prevLabel}][s${i}]xfade=transition=fade:duration=${XFADE_DUR}:offset=${offset.toFixed(3)}[${outLabel}]`
    );
    prevLabel = outLabel;
    prevOutDuration = prevOutDuration + clips[i].duration - XFADE_DUR;
  }

  return { filterStr: parts.join(";"), outputLabel: "vout" };
}

// ─── Main job processor ───────────────────────────────────────────────────────

async function processExport(job: Job<VideoExportJob>): Promise<void> {
  const { projectId, userId } = job.data;
  console.log(`[videoWorker] START | projectId=${projectId}`);

  const project = await prisma.videoProject.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const clips = project.timelineData as unknown as TimelineClip[];
  const tempDir = path.join(os.tmpdir(), `brandefai_${projectId}`);

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });

    // ── Step 1: Download all clips ────────────────────────────────────────────
    console.log(`[videoWorker] Downloading ${clips.length} clip(s)`);
    const localPaths = await Promise.all(
      clips.map(async (clip, i) => {
        const dest = path.join(tempDir, `clip_${i}.mp4`);
        await downloadClip(clip.sourceUrl, dest);
        console.log(`[videoWorker] Downloaded clip ${i} → ${dest}`);
        return dest;
      })
    );

    // ── Step 2: Write concat file (always written; used for simple path) ──────
    const concatListPath = path.join(tempDir, "filelist.txt");
    const concatContent = localPaths.map((p) => `file '${p}'`).join("\n");
    await fs.promises.writeFile(concatListPath, concatContent, "utf8");

    // ── Step 3: Build and run FFmpeg ──────────────────────────────────────────
    const outputPath = path.join(tempDir, "output.mp4");
    const hasTransitions = clips.some((c) => c.transitionType === "crossfade");

    const { filterStr, outputLabel } = buildFilterComplex(clips, hasTransitions);

    let cmd = ffmpeg();
    for (const p of localPaths) cmd = cmd.input(p);

    cmd
      .complexFilter(filterStr, [outputLabel])
      .outputOptions([
        `-map [${outputLabel}]`,
        "-c:v libx264",
        "-preset fast",
        "-crf 22",
        "-movflags +faststart",
        "-an", // no audio track for now
      ])
      .output(outputPath);

    console.log(`[videoWorker] Running FFmpeg | transitions=${hasTransitions}`);
    await runFfmpeg(cmd);
    console.log(`[videoWorker] FFmpeg done`);

    // ── Step 4: Upload to S3 ──────────────────────────────────────────────────
    const s3Key = `videos/${userId}/${projectId}/output.mp4`;
    const exportUrl = await uploadToS3(outputPath, s3Key);
    console.log(`[videoWorker] Uploaded to S3 | ${exportUrl}`);

    // ── Step 5: Update DB + deduct credits ────────────────────────────────────
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: VideoStatus.COMPLETED, exportUrl },
    });

    await deductCredits(prisma, userId, 10, CreditType.VIDEO_EXPORT, projectId);
    console.log(`[videoWorker] DONE | projectId=${projectId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[videoWorker] FAILED | projectId=${projectId} | ${msg}`);

    await prisma.videoProject.update({
      where: { id: projectId },
      data: { status: VideoStatus.FAILED },
    }).catch(() => {});

    throw err; // Re-throw so BullMQ marks the job as failed
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Start worker (runs when this module is imported) ─────────────────────────

export const videoExportWorker = new Worker<VideoExportJob>(
  "video-exports",
  processExport,
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

videoExportWorker.on("completed", (job) => {
  console.log(`[videoWorker] Job completed | id=${job.id}`);
});

videoExportWorker.on("failed", (job, err) => {
  console.error(`[videoWorker] Job failed | id=${job?.id} | ${err.message}`);
});
