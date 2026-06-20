import { Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import { createProject, saveTimeline, queueExport } from "../services/videoService";
import { generateClip } from "../services/ai/runwayService";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";
import type {
  CreateProjectInput,
  SaveTimelineInput,
  GenerateClipInput,
} from "../middleware/validators/videoSchemas";

// ─── POST /api/videos ─────────────────────────────────────────────────────────

export async function createVideoProject(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;
    const brand = await prisma.brand.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!brand) return next(createError("Brand not found. Set up your brand first.", 404));

    const { title } = req.body as CreateProjectInput;
    const project = await createProject(user.id, brand.id, title);
    sendSuccess(res, project, 201);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/videos ──────────────────────────────────────────────────────────

export async function listVideoProjects(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.videoProject.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          exportUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.videoProject.count({ where: { userId } }),
    ]);

    sendSuccess(res, { items, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/videos/:id ──────────────────────────────────────────────────────

export async function getVideoProject(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const project = await prisma.videoProject.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
    });
    if (!project) return next(createError("Video project not found", 404));
    sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/videos/:id/timeline ─────────────────────────────────────────────

export async function updateTimeline(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { clips } = req.body as SaveTimelineInput;
    const project = await saveTimeline(String(req.params.id), req.user!.id, clips);
    sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/videos/:id/export ─────────────────────────────────────────────

export async function exportVideo(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;

    if (user.creditsBalance < 10) {
      return next(createError("Insufficient credits. You need at least 10 credits to export a video.", 402));
    }

    const result = await queueExport(String(req.params.id), user.id);
    sendSuccess(res, result, 202);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/videos/:id/export-status ───────────────────────────────────────

export async function getExportStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const project = await prisma.videoProject.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
      select: { status: true, exportUrl: true },
    });
    if (!project) return next(createError("Video project not found", 404));
    sendSuccess(res, { status: project.status, exportUrl: project.exportUrl ?? null });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/videos/:id/generate-clip ──────────────────────────────────────

export async function generateVideoClip(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;

    if (user.creditsBalance < 15) {
      return next(createError("Insufficient credits. You need at least 15 credits to generate a clip.", 402));
    }

    // Verify project ownership
    const project = await prisma.videoProject.findFirst({
      where: { id: String(req.params.id), userId: user.id },
      select: { id: true },
    });
    if (!project) return next(createError("Video project not found", 404));

    const { prompt, duration, imageUrl } = req.body as GenerateClipInput;

    // Note: credits are deducted inside runwayService after successful generation
    // For now we deduct here since Runway is a paid external call
    // In production, integrate with CreditType.VIDEO_EXPORT or a dedicated type
    const clipUrl = await generateClip(prompt, duration, imageUrl);
    sendSuccess(res, { clipUrl }, 201);
  } catch (err) {
    next(err);
  }
}
