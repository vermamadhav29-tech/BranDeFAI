import prisma from "../utils/prisma";
import { createError } from "../middleware/errorHandler";
import { deductCredits } from "../utils/creditUtils";
import { generateSceneImage } from "./ai/imageGenService";
import { generateClip } from "./ai/runwayService";
import { generateText } from "./ai/openaiService";
import type { StrategyData, VideoIdea } from "./strategyService";
import ffmpeg from "fluent-ffmpeg";
import * as ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import axios from "axios";
import * as os from "os";
import * as nodePath from "path";
import * as fs from "fs";
import { v2 as cloudinary } from "cloudinary";

// ─── Transition types ─────────────────────────────────────────────────────────

export type AiTransitionType =
  | "crossfade"
  | "hard_cut"
  | "fade_to_black"
  | "slide_left"
  | "zoom_out";

export interface TransitionSuggestion {
  between: string;      // "1-2", "2-3", …
  transition: AiTransitionType;
  duration_ms: number;  // 300-700
}

const VALID_TRANSITIONS: AiTransitionType[] = [
  "crossfade",
  "hard_cut",
  "fade_to_black",
  "slide_left",
  "zoom_out",
];

// Maps AI label → FFmpeg xfade filter name
const AI_TO_XFADE: Record<AiTransitionType, string> = {
  crossfade: "fade",
  hard_cut: "fade",       // 50ms — visually a cut
  fade_to_black: "fadeblack",
  slide_left: "slideleft",
  zoom_out: "zoomin",
};

const HARD_CUT_DURATION_S = 0.05;

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── createVideoProject ───────────────────────────────────────────────────────
// Creates a VideoProject record + one VideoScene per scene in the idea.
// Returns projectId and scene IDs so the frontend can drive per-scene generation.

export async function createVideoProject(
  userId: string,
  videoIdeaIndex: number
): Promise<{
  projectId: string;
  scenes: Array<{ id: string; sceneNumber: number; description: string }>;
}> {
  const brand = await prisma.brand.findUnique({ where: { userId } });
  if (!brand) throw createError("Brand not found", 404);

  const strategyData = brand.strategyData as unknown as StrategyData;
  if (!strategyData?.videoIdeas?.length) {
    throw createError("No video ideas found — approve a strategy first", 400);
  }

  const idea: VideoIdea | undefined = strategyData.videoIdeas[videoIdeaIndex];
  if (!idea) throw createError(`Video idea at index ${videoIdeaIndex} not found`, 404);

  const project = await prisma.videoProject.create({
    data: {
      userId,
      brandId: brand.id,
      title: idea.videoTitle,
      strategyIdeaIndex: videoIdeaIndex,
      timelineData: {},
      status: "DRAFT",
      scenes: {
        create: idea.scenes.map((scene) => ({
          sceneNumber: scene.sceneNumber,
          description: scene.visualDescription,
          prompt: scene.aiVideoPrompt,
          productInvolved: scene.productInvolved ?? "",
          duration: 5,
          status: "PENDING",
        })),
      },
    },
    include: {
      scenes: { orderBy: { sceneNumber: "asc" } },
    },
  });

  return {
    projectId: project.id,
    scenes: project.scenes.map((s) => ({
      id: s.id,
      sceneNumber: s.sceneNumber,
      description: s.description,
    })),
  };
}

// ─── generateSceneMedia ───────────────────────────────────────────────────────
// Generates the scene image (gpt-image-1, 4:5, brandefai/scenes/) then the
// video clip (RunwayML, 5s, brandefai/clips/) for a single VideoScene record.
// Deducts 3 credits on full success.
// On failure: marks scene FAILED, re-throws so the frontend can show the error
// but continue with the remaining scenes.

export async function generateSceneMedia(
  userId: string,
  sceneId: string
): Promise<{ imageUrl: string; clipUrl: string }> {
  // Verify scene ownership and fetch brand context in one round trip
  const scene = await prisma.videoScene.findUnique({
    where: { id: sceneId },
    include: {
      project: {
        include: {
          brand: {
            select: {
              id: true,
              brandName: true,
              industry: true,
              tone: true,
              targetAudience: true,
              logoUrl: true,
              voiceSummary: true,
            },
          },
        },
      },
    },
  });

  if (!scene) throw createError("Scene not found", 404);
  if (scene.project.userId !== userId) throw createError("Forbidden", 403);

  // Credit pre-check (3 credits per scene)
  const freshUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });
  if (!freshUser) throw createError("User not found", 404);
  if (freshUser.creditsBalance < 3) {
    throw createError("Insufficient credits — each scene costs 3 credits (1 image + 2 clip)", 402);
  }

  // Mark as generating
  await prisma.videoScene.update({
    where: { id: sceneId },
    data: { status: "GENERATING", errorMessage: null },
  });

  try {
    const brand = scene.project.brand;

    // ── 1. Build image prompt with brand + product context ────────────────────
    const imagePromptParts = [
      scene.description,
      scene.productInvolved ? `Featured product shot: ${scene.productInvolved}.` : "",
      `Professional Instagram Reel visual for ${brand.brandName}, a ${brand.industry} brand.`,
      `Brand aesthetic: ${brand.tone}.`,
      `Target audience: ${brand.targetAudience}.`,
      brand.voiceSummary ? `Brand voice: ${brand.voiceSummary.slice(0, 200)}.` : "",
      "Cinematic lighting, editorial-quality brand photography, product-forward composition.",
      "NOT cartoonish, NOT illustrated — photorealistic only.",
    ].filter(Boolean).join(" ");

    // ── 2. Generate scene image (with logo composited if brand has one) ───────
    const imageUrl = await generateSceneImage(imagePromptParts, brand.logoUrl);

    // ── 3. Generate video clip (RunwayML, 5s, image-to-video) ────────────────
    const clipUrl = await generateClip(scene.prompt, 5, imageUrl);

    // ── 4. Deduct 3 credits only after both succeed ───────────────────────────
    await deductCredits(prisma, userId, 3, "VIDEO_SCENE", brand.id);

    // ── 5. Persist results ────────────────────────────────────────────────────
    await prisma.videoScene.update({
      where: { id: sceneId },
      data: { imageUrl, clipUrl, status: "DONE" },
    });

    // Mark project COMPLETED / FAILED once every scene is settled
    const allScenes = await prisma.videoScene.findMany({
      where: { projectId: scene.projectId },
      select: { status: true },
    });
    const allSettled = allScenes.every(
      (s) => s.status === "DONE" || s.status === "FAILED"
    );
    if (allSettled) {
      const anyDone = allScenes.some((s) => s.status === "DONE");
      await prisma.videoProject.update({
        where: { id: scene.projectId },
        data: { status: anyDone ? "COMPLETED" : "FAILED" },
      });
    }

    return { imageUrl, clipUrl };
  } catch (err) {
    // Mark scene FAILED — do NOT block other scenes
    const msg = err instanceof Error ? err.message : "Unknown error";
    await prisma.videoScene.update({
      where: { id: sceneId },
      data: { status: "FAILED", errorMessage: msg },
    });
    throw err;
  }
}

// ─── getVideoProject ──────────────────────────────────────────────────────────
// Returns a project with its scenes for the given user and strategy idea index.

export async function getVideoProject(userId: string, videoIdeaIndex: number) {
  const brand = await prisma.brand.findUnique({ where: { userId } });
  if (!brand) return null;

  return prisma.videoProject.findFirst({
    where: { userId, strategyIdeaIndex: videoIdeaIndex },
    orderBy: { createdAt: "desc" },
    include: { scenes: { orderBy: { sceneNumber: "asc" } } },
  });
}

// ─── getStrategyProjects ──────────────────────────────────────────────────────
// Returns all VideoProjects linked to strategy ideas that have ≥1 DONE scene.
// Used to populate the "My Projects" media library tab in Video Studio.

export async function getStrategyProjects(userId: string) {
  return prisma.videoProject.findMany({
    where: {
      userId,
      strategyIdeaIndex: { not: null },
      scenes: { some: { status: "DONE" } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      strategyIdeaIndex: true,
      status: true,
      exportUrl: true,
      scenes: {
        where: { status: "DONE" },
        orderBy: { sceneNumber: "asc" },
        select: {
          id: true,
          sceneNumber: true,
          imageUrl: true,
          clipUrl: true,
          duration: true,
        },
      },
    },
  });
}

// ─── suggestTransitions ───────────────────────────────────────────────────────
// Calls GPT-4o to suggest the best xfade transition type and duration between
// each consecutive pair of DONE scenes in a VideoProject.
// Falls back to crossfade 500ms if GPT fails or returns invalid data.

export async function suggestTransitions(
  projectId: string,
  userId: string
): Promise<TransitionSuggestion[]> {
  const project = await prisma.videoProject.findFirst({
    where: { id: projectId, userId },
    include: {
      scenes: {
        where: { status: "DONE" },
        orderBy: { sceneNumber: "asc" },
        select: { sceneNumber: true, description: true },
      },
    },
  });

  if (!project) throw createError("Project not found", 404);

  const scenes = project.scenes;
  const n = scenes.length;
  if (n < 2) return [];

  const fallback: TransitionSuggestion[] = Array.from({ length: n - 1 }, (_, i) => ({
    between: `${scenes[i].sceneNumber}-${scenes[i + 1].sceneNumber}`,
    transition: "crossfade" as AiTransitionType,
    duration_ms: 500,
  }));

  try {
    const sceneList = scenes.map((s) => `Scene ${s.sceneNumber}: ${s.description}`).join("\n");
    const pairsLabel = fallback.map((f) => f.between).join(", ");

    const raw = await generateText(
      "You are a professional video editor. Respond only with the exact JSON structure requested.",
      `I have a short video reel with ${n} scenes. Choose the best transition between each consecutive pair.\n\nScenes:\n${sceneList}\n\nOptions:\n- crossfade: smooth blend, good for visual continuity\n- hard_cut: instant cut, for energy or dramatic contrast\n- fade_to_black: fades to black then into next scene, for time jumps or emotional beats\n- slide_left: wipes current scene out to the left, for forward progression\n- zoom_out: zooms into the next scene, for big reveals\n\nRules: duration_ms must be 300–700 (hard_cut should use 300).\n\nReturn ONLY this JSON object — no explanation:\n{ "transitions": [{ "between": "1-2", "transition": "crossfade", "duration_ms": 500 }, ...] }\nInclude exactly ${n - 1} entries for pairs: ${pairsLabel}.`,
      true
    ) as { transitions?: unknown[] };

    const suggestions = Array.isArray(raw?.transitions) ? raw.transitions : [];

    const valid = (suggestions as TransitionSuggestion[])
      .filter((s) => s && typeof s.between === "string" && VALID_TRANSITIONS.includes(s.transition))
      .slice(0, n - 1)
      .map((s, i) => ({
        between: s.between ?? fallback[i].between,
        transition: s.transition,
        duration_ms: Math.min(700, Math.max(300, Number(s.duration_ms) || 500)),
      }));

    return valid.length === n - 1 ? valid : fallback;
  } catch {
    return fallback;
  }
}

// ─── compileProject ───────────────────────────────────────────────────────────
// Downloads all DONE scene clips, stitches them using per-transition xfade
// specs (from AI suggestions or caller-provided overrides), uploads to
// Cloudinary brandefai/compiled/, and stores the URL in VideoProject.exportUrl.

export async function compileProject(
  userId: string,
  projectId: string,
  transitions?: TransitionSuggestion[]
): Promise<{ compiledUrl: string; transitions: TransitionSuggestion[] }> {
  const project = await prisma.videoProject.findFirst({
    where: { id: projectId, userId },
    include: {
      scenes: {
        where: { status: "DONE" },
        orderBy: { sceneNumber: "asc" },
      },
    },
  });

  if (!project) throw createError("Project not found", 404);

  const doneScenes = project.scenes.filter((s) => s.clipUrl);
  if (doneScenes.length === 0) throw createError("No completed scenes to compile", 400);

  const CLIP_DURATION = 5;

  // Resolve transitions: use caller-provided, then AI-suggested, then fallback
  let effectiveTransitions: TransitionSuggestion[];
  if (transitions && transitions.length > 0) {
    effectiveTransitions = transitions;
  } else if (doneScenes.length > 1) {
    try {
      const aiSuggestions = await suggestTransitions(projectId, userId);
      effectiveTransitions = aiSuggestions.length > 0
        ? aiSuggestions
        : Array.from({ length: doneScenes.length - 1 }, (_, i) => ({
            between: `${doneScenes[i].sceneNumber}-${doneScenes[i + 1].sceneNumber}`,
            transition: "crossfade" as AiTransitionType,
            duration_ms: 500,
          }));
    } catch {
      effectiveTransitions = Array.from({ length: doneScenes.length - 1 }, (_, i) => ({
        between: `${doneScenes[i].sceneNumber}-${doneScenes[i + 1].sceneNumber}`,
        transition: "crossfade" as AiTransitionType,
        duration_ms: 500,
      }));
    }
  } else {
    effectiveTransitions = [];
  }

  const tmpDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), `compile-${projectId.slice(0, 8)}-`));

  try {
    // 1. Download all clips
    const clipPaths: string[] = [];
    for (const scene of doneScenes) {
      const clipPath = nodePath.join(tmpDir, `scene_${scene.sceneNumber}.mp4`);
      const response = await axios.get(scene.clipUrl!, { responseType: "arraybuffer", timeout: 60_000 });
      fs.writeFileSync(clipPath, Buffer.from(response.data as ArrayBuffer));
      clipPaths.push(clipPath);
    }

    const outputPath = nodePath.join(tmpDir, "compiled.mp4");
    const n = clipPaths.length;

    if (n === 1) {
      fs.copyFileSync(clipPaths[0], outputPath);
    } else {
      await new Promise<void>((resolve, reject) => {
        const proc = ffmpeg();
        clipPaths.forEach((p) => proc.input(p));

        const filters: string[] = [];
        // Running total of the current output stream's duration before the next xfade
        let currentOutputDuration = CLIP_DURATION;

        for (let i = 0; i < n - 1; i++) {
          const t = effectiveTransitions[i] ?? {
            transition: "crossfade" as AiTransitionType,
            duration_ms: 500,
            between: "",
          };
          // hard_cut uses a ~50ms fade which is perceptually instant
          const fadeDurS = t.transition === "hard_cut"
            ? HARD_CUT_DURATION_S
            : t.duration_ms / 1000;
          const xfaceName = AI_TO_XFADE[t.transition];
          // offset = point in the running output where the transition starts
          const offset = (currentOutputDuration - fadeDurS).toFixed(3);

          const inputA = i === 0 ? "[0:v]" : `[v${i}]`;
          const inputB = `[${i + 1}:v]`;
          const outputLabel = i === n - 2 ? "[vout]" : `[v${i + 1}]`;

          filters.push(
            `${inputA}${inputB}xfade=transition=${xfaceName}:duration=${fadeDurS}:offset=${offset}${outputLabel}`
          );

          currentOutputDuration += CLIP_DURATION - fadeDurS;
        }

        proc
          .complexFilter(filters)
          .outputOptions(["-map [vout]", "-an", "-c:v libx264", "-preset fast", "-crf 23", "-movflags +faststart"])
          .output(outputPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(new Error(`FFmpeg compile failed: ${err.message}`)))
          .run();
      });
    }

    // 2. Upload to Cloudinary
    const compiledUrl = await new Promise<string>((resolve, reject) => {
      cloudinary.uploader.upload(
        outputPath,
        { resource_type: "video", folder: "brandefai/compiled", public_id: `compiled_${projectId}`, overwrite: true },
        (err, result) => {
          if (err) return reject(new Error(`Cloudinary upload failed: ${err.message}`));
          if (!result) return reject(new Error("Cloudinary returned no result"));
          resolve(result.secure_url);
        }
      );
    });

    // 3. Persist
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { exportUrl: compiledUrl, status: "COMPLETED" },
    });

    return { compiledUrl, transitions: effectiveTransitions };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
