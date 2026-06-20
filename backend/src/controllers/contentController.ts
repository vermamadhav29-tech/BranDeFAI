import { Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import * as contentService from "../services/contentService";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";
import type { GenerateContentInput } from "../middleware/validators/contentSchemas";

// ─── POST /api/content/generate ───────────────────────────────────────────────

export async function generateContent(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;

    if (user.creditsBalance < 20) {
      return next(createError("Insufficient credits. You need at least 20 credits to generate content.", 402));
    }

    const { productImageId } = req.body as GenerateContentInput;

    const brand = await prisma.brand.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!brand) {
      return next(createError("Brand not found. Set up your brand first.", 404));
    }

    const result = await contentService.generateContentBatch(user.id, brand.id, productImageId);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/content/latest ─────────────────────────────────────────────────

export async function getLatestContent(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const content = await prisma.generatedContent.findFirst({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    sendSuccess(res, content ?? null);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/content ─────────────────────────────────────────────────────────

export async function listContent(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.generatedContent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.generatedContent.count({ where: { userId } }),
    ]);

    sendSuccess(res, { items, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/content/count ───────────────────────────────────────────────────

export async function countContent(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const count = await prisma.generatedContent.count({ where: { userId: req.user!.id } });
    sendSuccess(res, { count });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/content/:id ─────────────────────────────────────────────────────

export async function getContent(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const content = await prisma.generatedContent.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
    });
    if (!content) {
      return next(createError("Content not found", 404));
    }
    sendSuccess(res, content);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/content/:id/regenerate-caption ─────────────────────────────────

export async function regenerateCaption(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;

    if (user.creditsBalance < 2) {
      return next(createError("Insufficient credits. You need at least 2 credits.", 402));
    }

    const captions = await contentService.regenerateCaptions(String(req.params.id), user.id);
    sendSuccess(res, { captions });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/content/:id/regenerate-adcopy ──────────────────────────────────

export async function regenerateAdCopy(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;

    if (user.creditsBalance < 2) {
      return next(createError("Insufficient credits. You need at least 2 credits.", 402));
    }

    const adCopy = await contentService.regenerateAdCopy(String(req.params.id), user.id);
    sendSuccess(res, { adCopy });
  } catch (err) {
    next(err);
  }
}
