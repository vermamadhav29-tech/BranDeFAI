import { Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";
import { generateAutoCreative, getUpcomingOccasions } from "../services/autoCreative.service";
import type { GeneratePostInput, UpdatePostStatusInput, UpdatePostCaptionInput } from "../middleware/validators/creativeSchemas";

// ─── POST /api/creative/generate ─────────────────────────────────────────────
// Manual trigger — costs 2 credits, fires synchronously (awaits result).

export async function triggerGenerate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    if (req.user!.creditsBalance < 2) {
      return next(createError("Insufficient credits. You need at least 2 credits to generate a post.", 402));
    }

    const brand = await prisma.brand.findUnique({ where: { userId } });
    if (!brand) return next(createError("Brand not found", 404));

    const { productImageId } = req.body as GeneratePostInput;

    // Re-check credits inside a transaction so we don't double-spend
    const freshUser = await prisma.user.findUnique({ where: { id: userId }, select: { creditsBalance: true } });
    if (!freshUser || freshUser.creditsBalance < 2) {
      return next(createError("Insufficient credits", 402));
    }

    // Deduct credits upfront (before the ~2 min generation)
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { creditsBalance: { decrement: 2 } } }),
      prisma.creditTransaction.create({
        data: {
          userId,
          amount: -2,
          type: "GENERATION",
          referenceId: brand.id,
          balanceAfter: freshUser.creditsBalance - 2,
        },
      }),
    ]);

    // Generate — this takes ~60-120 seconds, runs synchronously for manual
    const result = await generateAutoCreative(brand.id, userId, "manual", productImageId);

    if (!result) {
      // Refund credits if generation returned null (no product images etc.)
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { creditsBalance: { increment: 2 } } }),
        prisma.creditTransaction.create({
          data: {
            userId,
            amount: 2,
            type: "REFUND",
            referenceId: brand.id,
            balanceAfter: freshUser.creditsBalance,
          },
        }),
      ]).catch(() => {});
      return next(createError("Could not generate post. Upload a product photo first.", 422));
    }

    const post = await prisma.generatedPost.findUnique({ where: { id: result.postId } });
    sendSuccess(res, { post }, 201);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/creative/posts ──────────────────────────────────────────────────
// List generated posts for the authenticated user's brand.

export async function listPosts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const brand = await prisma.brand.findUnique({ where: { userId } });
    if (!brand) return next(createError("Brand not found", 404));

    const rawStatus = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
    const rawLimit  = Array.isArray(req.query.limit)  ? req.query.limit[0]  : (req.query.limit  ?? "20");
    const rawOffset = Array.isArray(req.query.offset) ? req.query.offset[0] : (req.query.offset ?? "0");
    const status = rawStatus as "PENDING_APPROVAL" | "APPROVED" | "SCHEDULED" | "POSTED" | undefined;

    const posts = await prisma.generatedPost.findMany({
      where: {
        brandId: brand.id,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(50, parseInt(rawLimit as string, 10)),
      skip: Math.max(0, parseInt(rawOffset as string, 10)),
      include: {
        productImage: { select: { imageUrl: true } },
      },
    });

    const total = await prisma.generatedPost.count({
      where: {
        brandId: brand.id,
        ...(status ? { status } : {}),
      },
    });

    sendSuccess(res, { posts, total });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/creative/posts/:id/status ────────────────────────────────────

export async function updatePostStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { status, scheduledAt } = req.body as UpdatePostStatusInput;

    const post = await prisma.generatedPost.findUnique({ where: { id } });
    if (!post || post.userId !== userId) return next(createError("Post not found", 404));

    const updated = await prisma.generatedPost.update({
      where: { id },
      data: {
        status,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
      },
    });

    sendSuccess(res, { post: updated });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/creative/posts/:id/caption ───────────────────────────────────

export async function updatePostCaption(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { caption, hashtags } = req.body as UpdatePostCaptionInput;

    const post = await prisma.generatedPost.findUnique({ where: { id } });
    if (!post || post.userId !== userId) return next(createError("Post not found", 404));

    const updated = await prisma.generatedPost.update({
      where: { id },
      data: { caption, ...(hashtags ? { hashtags } : {}) },
    });

    sendSuccess(res, { post: updated });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/creative/posts/:id ──────────────────────────────────────────

export async function deletePost(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const post = await prisma.generatedPost.findUnique({ where: { id } });
    if (!post || post.userId !== userId) return next(createError("Post not found", 404));

    await prisma.generatedPost.delete({ where: { id } });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/creative/occasions ─────────────────────────────────────────────
// Returns upcoming occasions within 14 days for the UI's info panel.

export async function listOccasions(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const occasions = getUpcomingOccasions(30);
    sendSuccess(res, { occasions });
  } catch (err) {
    next(err);
  }
}
