import { Response, NextFunction } from "express";
import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse, UploadApiOptions } from "cloudinary";
import prisma from "../utils/prisma";
import { analyzeImage } from "../services/ai/openaiService";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function streamUpload(buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "brandefai/products",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (err, result) => {
        if (err || !result) reject(err ?? new Error("Cloudinary upload failed"));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function streamUploadClip(buffer: Buffer, mimetype: string): Promise<UploadApiResponse> {
  const isVideo = mimetype.startsWith("video/");
  const options: UploadApiOptions = {
    folder: "brandefai/clips",
    resource_type: isVideo ? "video" : "image",
    ...(!isVideo && { transformation: [{ quality: "auto", fetch_format: "auto" }] }),
  };
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err || !result) {
        console.error("[upload-clip] Cloudinary error:", err);
        reject(err ?? new Error("Cloudinary upload failed"));
      } else {
        resolve(result);
      }
    });
    stream.end(buffer);
  });
}

export async function uploadProductImage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      return next(createError("No image file provided", 400));
    }

    const userId = req.user!.id;

    const brand = await prisma.brand.findUnique({ where: { userId } });
    if (!brand) {
      return next(createError("Brand not found. Set up your brand first.", 404));
    }

    const cloudResult = await streamUpload(req.file.buffer);
    const imageUrl = cloudResult.secure_url;

    const productImage = await prisma.productImage.create({
      data: { userId, brandId: brand.id, imageUrl },
    });

    const brandContext = `${brand.brandName} — ${brand.industry}, targeting ${brand.targetAudience}. Tone: ${brand.tone}.`;
    const visionAnalysis = await analyzeImage(imageUrl, brandContext);

    const updated = await prisma.productImage.update({
      where: { id: productImage.id },
      data: { visionAnalysis: JSON.parse(JSON.stringify(visionAnalysis)) },
    });

    sendSuccess(
      res,
      {
        productImageId: updated.id,
        imageUrl: updated.imageUrl,
        visionAnalysis: updated.visionAnalysis,
      },
      201
    );
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/uploads/bulk-product-images ───────────────────────────────────
// Upload up to 15 product images to Cloudinary in one request.
// No vision analysis here — that happens in POST /api/images/generate-post-briefs.

export async function bulkUploadProductImages(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      return next(createError("No images provided", 400));
    }

    const userId = req.user!.id;
    const brand = await prisma.brand.findUnique({ where: { userId } });
    if (!brand) {
      return next(createError("Brand not found. Set up your brand first.", 404));
    }

    // Upload all files to Cloudinary in parallel
    const uploadResults = await Promise.allSettled(
      files.map((file) => streamUpload(file.buffer))
    );

    // Create ProductImage records for every successful upload
    type UploadPair = { result: UploadApiResponse; file: Express.Multer.File };
    const pairs: UploadPair[] = uploadResults
      .map((r, i) => (r.status === "fulfilled" ? { result: r.value, file: files[i] } : null))
      .filter((x): x is UploadPair => x !== null);

    const productImages = await Promise.all(
      pairs.map(({ result, file }) =>
        prisma.productImage
          .create({ data: { userId, brandId: brand.id, imageUrl: result.secure_url } })
          .then((pi) => ({
            id: pi.id,
            imageUrl: pi.imageUrl,
            filename: file.originalname,
          }))
      )
    );

    sendSuccess(res, { images: productImages }, 201);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/uploads/brand-logo ────────────────────────────────────────────
// Uploads a logo to Cloudinary and returns the URL. No brand required —
// called during onboarding before brand creation, or from settings page.

export async function uploadBrandLogo(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      return next(createError("No logo file provided", 400));
    }

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "brandefai/logos",
          resource_type: "image",
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        },
        (err, res) => {
          if (err || !res) reject(err ?? new Error("Cloudinary upload failed"));
          else resolve(res);
        }
      );
      stream.end(req.file!.buffer);
    });

    sendSuccess(res, { logoUrl: result.secure_url }, 201);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/uploads/video-clip ─────────────────────────────────────────────

export async function uploadVideoClip(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      console.error("[upload-clip] No file in request. Content-Type:", req.headers["content-type"]);
      return next(createError("No file provided. Send a 'video' field in multipart/form-data.", 400));
    }

    const { mimetype, originalname, size, buffer } = req.file;
    console.log(`[upload-clip] Received: name=${originalname} mime=${mimetype} size=${size} bytes`);

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error("[upload-clip] Cloudinary env vars missing");
      return next(createError("Storage not configured", 500));
    }

    console.log(`[upload-clip] Uploading to Cloudinary folder=brandefai/clips resource_type=${mimetype.startsWith("video/") ? "video" : "image"}`);

    const cloudResult = await streamUploadClip(buffer, mimetype);

    const clipUrl = cloudResult.secure_url;
    const duration =
      typeof (cloudResult as UploadApiResponse & { duration?: number }).duration === "number"
        ? Math.max(1, Math.round((cloudResult as UploadApiResponse & { duration?: number }).duration!))
        : 4; // images have no duration — default 4s on the timeline

    console.log(`[upload-clip] Success: url=${clipUrl} duration=${duration}s public_id=${cloudResult.public_id}`);

    sendSuccess(res, { clipUrl, duration }, 201);
  } catch (err) {
    console.error("[upload-clip] Unhandled error:", err);
    next(err);
  }
}
