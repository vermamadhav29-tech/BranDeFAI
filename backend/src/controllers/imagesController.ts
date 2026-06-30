import { Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import { generateStandaloneImage, deleteCloudinaryImage, generateProductPostImages } from "../services/ai/imageGenService";
import { generateLifestyleImage as generateLifestyleImageFlux } from "../services/fluxImage.service";
import { generatePostBrief as generatePostBriefAI } from "../services/ai/openaiService";
import type { PostBriefData, VisionAnalysis } from "../services/ai/openaiService";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";
import type { GenerateImageInput, GeneratePostBriefsInput, GenerateProductPostsInput, LifestyleImageInput } from "../middleware/validators/imageSchemas";

// ─── POST /api/images/generate ────────────────────────────────────────────────

export async function generateImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;

    if (user.creditsBalance < 5) {
      return next(createError("Insufficient credits. You need at least 5 credits to generate an image.", 402));
    }

    const brand = await prisma.brand.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!brand) {
      return next(createError("Brand not found. Set up your brand first.", 404));
    }

    const { prompt, style, format, referenceImageUrl, includeLogo } = req.body as GenerateImageInput;

    const result = await generateStandaloneImage(user.id, brand.id, prompt, style, format, referenceImageUrl, includeLogo);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/images ──────────────────────────────────────────────────────────

export async function listImages(
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
      prisma.generatedImage.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.generatedImage.count({ where: { userId } }),
    ]);

    sendSuccess(res, { items, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/images/count ────────────────────────────────────────────────────

export async function countImages(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const count = await prisma.generatedImage.count({ where: { userId: req.user!.id } });
    sendSuccess(res, { count });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/images/generate-post-briefs ────────────────────────────────────

interface BriefResult {
  id: string;
  productImageId: string;
  imageUrl: string;
  briefJson: PostBriefData;
  createdAt: string;
}

export async function generatePostBriefs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { productImageIds } = req.body as GeneratePostBriefsInput;

    const brand = await prisma.brand.findUnique({ where: { userId } });
    if (!brand) return next(createError("Brand not found", 404));

    const productImages = await prisma.productImage.findMany({
      where: { id: { in: productImageIds }, userId },
    });
    if (!productImages.length) return next(createError("Product images not found", 404));

    const results = await Promise.allSettled(
      productImages.map(async (pi) => {
        const brief = await generatePostBriefAI(pi.imageUrl, {
          brandName: brand.brandName,
          industry: brand.industry,
          tone: brand.tone,
          targetAudience: brand.targetAudience,
          voiceSummary: brand.voiceSummary,
        });

        const saved = await prisma.postBrief.create({
          data: {
            userId,
            productImageId: pi.id,
            briefJson: JSON.parse(JSON.stringify(brief)),
          },
        });

        return {
          id: saved.id,
          productImageId: pi.id,
          imageUrl: pi.imageUrl,
          briefJson: brief,
          createdAt: saved.createdAt.toISOString(),
        } as BriefResult;
      })
    );

    const briefs = results
      .filter((r): r is PromiseFulfilledResult<BriefResult> => r.status === "fulfilled")
      .map((r) => r.value);

    sendSuccess(res, { briefs });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/images/generate-product-posts ─────────────────────────────────
// Generates one promotional 1080×1350 Instagram post image using a post brief.
// Frontend calls this once per image (twice per product) with a 3 s delay.

export async function generateProductPosts(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { briefId } = req.body as GenerateProductPostsInput;

    // Check credits upfront
    const freshUser = await prisma.user.findUnique({ where: { id: userId }, select: { creditsBalance: true } });
    if (!freshUser || freshUser.creditsBalance < 5) {
      return next(createError("Insufficient credits. You need at least 5 credits to generate an image.", 402));
    }

    const brief = await prisma.postBrief.findFirst({
      where: { id: briefId, userId },
      include: { productImage: true },
    });
    if (!brief) return next(createError("Post brief not found", 404));

    const brand = await prisma.brand.findUnique({ where: { userId } });
    if (!brand) return next(createError("Brand not found", 404));

    const briefData = brief.briefJson as unknown as PostBriefData;
    const visionAnalysis = brief.productImage.visionAnalysis as VisionAnalysis | null;

    const result = await generateProductPostImages(
      userId,
      brand.id,
      briefId,
      brief.productImage.imageUrl,
      briefData,
      visionAnalysis
    );

    sendSuccess(res, { image: result }, 201);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/images/post-briefs ─────────────────────────────────────────────

export async function listPostBriefs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;

    const records = await prisma.postBrief.findMany({
      where: { userId },
      include: {
        productImage: { select: { imageUrl: true } },
        generatedImages: {
          select: { id: true, imageUrl: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    const briefs = records.map((b) => ({
      id: b.id,
      productImageId: b.productImageId,
      imageUrl: b.productImage.imageUrl,
      briefJson: b.briefJson as unknown as PostBriefData,
      createdAt: b.createdAt.toISOString(),
      generatedImages: b.generatedImages,
    }));

    sendSuccess(res, { briefs });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/images/lifestyle ───────────────────────────────────────────────
// Generates a realistic lifestyle/product photo via Flux 2 Pro.

export async function generateLifestyleImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;

    if (user.creditsBalance < 5) {
      return next(createError("Insufficient credits. You need at least 5 credits to generate an image.", 402));
    }

    const { brief, brandId } = req.body as LifestyleImageInput;

    const result = await generateLifestyleImageFlux(user.id, brandId, brief);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/images/:id ───────────────────────────────────────────────────

export async function deleteImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const imageId = String(req.params.id);

    const image = await prisma.generatedImage.findFirst({
      where: { id: imageId, userId },
    });
    if (!image) {
      return next(createError("Image not found", 404));
    }

    // Delete from DB first so the record is always gone from the user's perspective
    await prisma.generatedImage.delete({ where: { id: imageId } });

    // Best-effort Cloudinary cleanup (logs on failure but doesn't surface error to user)
    await deleteCloudinaryImage(image.imageUrl);

    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}
