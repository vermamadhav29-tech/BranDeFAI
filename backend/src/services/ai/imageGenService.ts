import OpenAI, { toFile } from "openai";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { ImageSource, CreditType } from "@prisma/client";
import { createError } from "../../middleware/errorHandler";
import prisma from "../../utils/prisma";
import { deductCredits } from "../../utils/creditUtils";
import type { PostBriefData, VisionAnalysis } from "./openaiService";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90_000,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type ImageFormat = "1:1" | "4:5" | "16:9";

const SIZE_MAP: Record<ImageFormat, "1024x1024" | "1024x1536" | "1536x1024"> = {
  "1:1": "1024x1024",
  "4:5": "1024x1536",
  "16:9": "1536x1024",
};

// ─── uploadBufferToCloudinary ─────────────────────────────────────────────────

async function uploadBufferToCloudinary(buffer: Buffer, folder = "brandefai/generated"): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => {
        if (err) {
          console.error(`[imageGen] Cloudinary error | http_code=${err.http_code} | ${err.message}`);
          return reject(new Error(`Cloudinary: ${err.message}`));
        }
        if (!result) {
          return reject(new Error("Cloudinary returned no result"));
        }
        console.log(`[imageGen] Cloudinary upload success | ${result.secure_url}`);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// ─── generateImageBuffer ──────────────────────────────────────────────────────
// Internal. Returns raw PNG/JPEG buffer from gpt-image-1 (with one 429 retry).

async function generateImageBuffer(
  prompt: string,
  style: string,
  format: ImageFormat
): Promise<Buffer> {
  const startedAt = Date.now();
  const imagePrompt = (style ? `${prompt}. Style: ${style}.` : prompt).slice(0, 32000);

  console.log(
    `[imageGen] START | format=${format} | size=${SIZE_MAP[format]} | ${new Date().toISOString()}`
  );

  async function callApi(): Promise<Buffer> {
    const response = await openai.images.generate({
      stream: false,
      model: "gpt-image-1",
      prompt: imagePrompt,
      n: 1,
      size: SIZE_MAP[format],
      quality: "medium",
    });

    const item = response.data?.[0];
    if (!item) throw new Error("gpt-image-1 response contained no image data");
    if (!item.b64_json) {
      throw new Error(
        `gpt-image-1 returned no b64_json (response keys: ${Object.keys(item).join(", ")})`
      );
    }

    const buffer = Buffer.from(item.b64_json, "base64");
    console.log(`[imageGen] API done | bytes=${buffer.length} | elapsed=${elapsed(startedAt)}s`);
    return buffer;
  }

  try {
    return await callApi();
  } catch (err: unknown) {
    const e = err as {
      status?: number;
      message?: string;
      error?: { message?: string; code?: string; type?: string };
    };

    if (e.status === 429) {
      console.warn(`[imageGen] Rate limited, retrying after 12s… | elapsed=${elapsed(startedAt)}s`);
      await new Promise((r) => setTimeout(r, 12000));
      try {
        const buf = await callApi();
        console.log(`[imageGen] Retry succeeded | elapsed=${elapsed(startedAt)}s`);
        return buf;
      } catch (retryErr: unknown) {
        const re = retryErr as { message?: string; error?: { message?: string } };
        const msg = re.error?.message ?? re.message ?? "retry failed";
        console.error(`[imageGen] FAILED (retry) | elapsed=${elapsed(startedAt)}s | ${msg}`);
        throw createError(`Image generation rate limited: ${msg}`, 429);
      }
    }

    const msg = e.error?.message ?? e.message ?? "unknown error";
    const code = e.status ?? "unknown";
    console.error(
      `[imageGen] FAILED | elapsed=${elapsed(startedAt)}s | status=${code} | type=${e.error?.type ?? "n/a"} | ${msg}`
    );
    throw createError(`Image generation failed (${code}): ${msg}`, 502);
  }
}

// ─── compositeLogoOnImage ─────────────────────────────────────────────────────
// Places the brand logo at bottom-right with a semi-transparent white pill.
// Logo is sized to 11% of image width; 20px padding from edges.
// Reads image dimensions from buffer metadata (works for any image size).

async function compositeLogoOnImage(
  imageBuffer: Buffer,
  logoUrl: string,
): Promise<Buffer> {
  const imgMeta = await sharp(imageBuffer).metadata();
  const iw = imgMeta.width ?? 1024;
  const ih = imgMeta.height ?? 1024;

  const logoSize = Math.round(iw * 0.11);
  const padding = 20;
  const pillPad = 10;

  // Fetch logo
  const logoRes = await fetch(logoUrl);
  if (!logoRes.ok) throw new Error(`Failed to fetch logo: ${logoRes.status}`);
  const logoRaw = Buffer.from(await logoRes.arrayBuffer());

  // Resize logo, convert to PNG for transparency
  const resizedLogo = await sharp(logoRaw)
    .resize(logoSize, logoSize, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  const logoMeta = await sharp(resizedLogo).metadata();
  const lw = logoMeta.width ?? logoSize;
  const lh = logoMeta.height ?? logoSize;

  // White rounded-rectangle pill behind logo
  const pillW = lw + pillPad * 2;
  const pillH = lh + pillPad * 2;
  const r = Math.round(Math.min(pillW, pillH) / 2);

  const pillSvg = Buffer.from(
    `<svg width="${pillW}" height="${pillH}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="${pillW}" height="${pillH}" rx="${r}" ry="${r}" fill="rgba(255,255,255,0.88)"/>` +
    `</svg>`
  );

  // Composite logo onto pill
  const logoPill = await sharp(pillSvg)
    .composite([{ input: resizedLogo, left: pillPad, top: pillPad }])
    .png()
    .toBuffer();

  const left = Math.max(0, iw - pillW - padding);
  const top = Math.max(0, ih - pillH - padding);

  return sharp(imageBuffer)
    .composite([{ input: logoPill, left, top }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

function elapsed(from: number): string {
  return ((Date.now() - from) / 1000).toFixed(1);
}

// ─── generateImage ────────────────────────────────────────────────────────────
// Public API used by contentService for bulk content generation.

export async function generateImage(
  prompt: string,
  style: string,
  format: ImageFormat
): Promise<string> {
  const buffer = await generateImageBuffer(prompt, style, format);
  return uploadBufferToCloudinary(buffer);
}

// ─── generateSceneImage ───────────────────────────────────────────────────────
// Generates a 4:5 scene image (1080×1350) for a VideoScene record.
// Composites brand logo at bottom-right if logoUrl is provided.
// Uploaded to brandefai/scenes/ — NOT saved to GeneratedImage table.

export async function generateSceneImage(
  prompt: string,
  logoUrl?: string | null
): Promise<string> {
  const buffer = await generateImageBuffer(
    prompt,
    "photorealistic, cinematic lighting, professional brand photography",
    "4:5"
  );
  let finalBuffer = await sharp(buffer)
    .resize(1080, 1350, { fit: "cover" })
    .jpeg({ quality: 92 })
    .toBuffer();

  if (logoUrl) {
    try {
      finalBuffer = await compositeLogoOnImage(finalBuffer, logoUrl);
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.warn(`[imageGen] Scene logo compositing failed — using unbranded image | ${e.message}`);
    }
  }

  return uploadBufferToCloudinary(finalBuffer, "brandefai/scenes");
}

// ─── generateStandaloneImage ──────────────────────────────────────────────────

export async function generateStandaloneImage(
  userId: string,
  brandId: string,
  originalPrompt: string,
  style: string,
  format: ImageFormat,
  referenceImageUrl?: string,
  includeLogo?: boolean
): Promise<{ imageId: string; imageUrl: string }> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand || brand.userId !== userId) throw createError("Brand not found", 404);

  let referenceContext = "";
  if (referenceImageUrl) {
    const productImage = await prisma.productImage.findFirst({
      where: { imageUrl: referenceImageUrl, userId },
    });
    if (productImage?.visionAnalysis) {
      const va = productImage.visionAnalysis as {
        productName?: string;
        physicalDescription?: string;
        colorPalette?: string[];
        marketingAngle?: string;
      };
      referenceContext =
        ` Reference product: ${va.productName ?? "product"}.` +
        (va.physicalDescription ? ` ${va.physicalDescription}.` : "") +
        (va.colorPalette?.length ? ` Colors: ${va.colorPalette.join(", ")}.` : "") +
        (va.marketingAngle ? ` Marketing angle: ${va.marketingAngle}.` : "");
    }
  }

  const enhancedPrompt =
    `${originalPrompt}.${referenceContext} Style: ${style}. Brand aesthetic: ${brand.tone}. High quality, professional marketing image.`;

  const startedAt = Date.now();

  const rawBuffer = await generateImageBuffer(enhancedPrompt, style, format);

  let finalBuffer = rawBuffer;
  if (includeLogo && brand.logoUrl) {
    try {
      finalBuffer = await compositeLogoOnImage(rawBuffer, brand.logoUrl);
      console.log(`[imageGen] Logo composited | elapsed=${elapsed(startedAt)}s`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error(`[imageGen] Logo compositing failed, using unbranded image | ${e.message}`);
      finalBuffer = rawBuffer;
    }
  }

  const imageUrl = await uploadBufferToCloudinary(finalBuffer);
  console.log(`[imageGen] DONE | format=${format} | elapsed=${elapsed(startedAt)}s | ${imageUrl}`);

  const record = await prisma.generatedImage.create({
    data: {
      userId,
      brandId,
      originalPrompt,
      enhancedPrompt,
      imageUrl,
      style,
      format,
      source: ImageSource.GENERATED,
    },
  });

  await deductCredits(prisma, userId, 5, CreditType.GENERATION, record.id);

  return { imageId: record.id, imageUrl };
}

// ─── buildProductPostPrompt ───────────────────────────────────────────────────

function buildProductPostPrompt(
  brand: {
    brandName: string;
    industry: string;
    tone: string;
    targetAudience: string;
    voiceSummary?: string | null;
  },
  brief: PostBriefData,
  visionAnalysis?: VisionAnalysis | null
): string {
  const productDesc = visionAnalysis?.physicalDescription ?? brief.postConcept;
  const colorHint = visionAnalysis?.colorPalette?.length
    ? ` Product colors: ${visionAnalysis.colorPalette.join(", ")}.`
    : "";

  const lines = [
    `Professional Instagram promotional post for ${brand.brandName}, a ${brand.industry} brand.`,
    `Product: ${productDesc}.${colorHint}`,
    `Background and scene: ${brief.visualBrief}`,
    `Composition: product is the hero, prominently centered or at golden-ratio position.`,
    `Text overlay area: reserve clean space for headline "${brief.textOverlay}" at the top or bottom third.`,
    `Target audience: ${brand.targetAudience}.`,
    `Style: editorial fashion photography, photorealistic, high-end brand aesthetic,`,
    `4:5 portrait ratio (1080×1350), soft studio lighting, clean premium feel.`,
    `The product must look exactly like the uploaded reference product photo — preserve shape, colors, details, and texture.`,
    `NOT cartoonish. NOT illustrated. NOT graphic design. Photographic quality only.`,
    `IMPORTANT: generate a realistic background scene around the product. Keep the product appearance identical to the input image.`,
  ];

  if (brand.voiceSummary) {
    lines.splice(1, 0, `Brand voice context: ${brand.voiceSummary.slice(0, 300)}`);
  }

  return lines.join("\n");
}

// ─── generateProductImageBuffer ──────────────────────────────────────────────
// Tries the gpt-image-1 edit endpoint with the product image as reference.
// Falls back to standard generation if edit endpoint fails.

async function generateProductImageBuffer(
  prompt: string,
  productBuffer: Buffer
): Promise<Buffer> {
  const startedAt = Date.now();

  // Convert product image to PNG (required by edit endpoint)
  const pngBuffer = await sharp(productBuffer).png().toBuffer();

  console.log(`[imageGen] Product post — trying edit endpoint | ${new Date().toISOString()}`);

  try {
    const imgFile = await toFile(pngBuffer, "product.png", { type: "image/png" });

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imgFile,
      prompt: prompt.slice(0, 32000),
      n: 1,
      size: "1024x1536",
      stream: false,
    });

    const item = response.data?.[0];
    if (!item?.b64_json) throw new Error("No image data from edit endpoint");

    const buf = Buffer.from(item.b64_json, "base64");
    console.log(`[imageGen] Edit endpoint success | bytes=${buf.length} | elapsed=${elapsed(startedAt)}s`);
    return buf;
  } catch (editErr: unknown) {
    const e = editErr as { status?: number; message?: string };
    console.warn(`[imageGen] Edit endpoint failed (${e.status ?? "?"}): ${e.message ?? "unknown"} — falling back to generate`);

    // Fallback: standard generation with detailed prompt
    return generateImageBuffer(prompt, "", "4:5");
  }
}

// ─── generateProductPostImages ────────────────────────────────────────────────
// Generates a single promotional Instagram post image (1080×1350) for a product.
// Called once per image — the caller is responsible for 3 s delay between calls.

export async function generateProductPostImages(
  userId: string,
  brandId: string,
  briefId: string,
  productImageUrl: string,
  brief: PostBriefData,
  visionAnalysis?: VisionAnalysis | null
): Promise<{ imageId: string; imageUrl: string }> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand || brand.userId !== userId) throw createError("Brand not found", 404);

  const startedAt = Date.now();

  // Fetch product image buffer
  const productRes = await fetch(productImageUrl);
  if (!productRes.ok) throw createError(`Failed to fetch product image: ${productRes.status}`, 500);
  const productBuffer = Buffer.from(await productRes.arrayBuffer());

  const prompt = buildProductPostPrompt(brand, brief, visionAnalysis);

  // Generate via edit (or fallback to generate)
  const rawBuffer = await generateProductImageBuffer(prompt, productBuffer);

  // Resize to 1080×1350 (Instagram portrait standard)
  const resizedBuffer = await sharp(rawBuffer)
    .resize(1080, 1350, { fit: "cover", position: "center" })
    .jpeg({ quality: 92 })
    .toBuffer();

  // Composite logo if brand has one
  let finalBuffer = resizedBuffer;
  if (brand.logoUrl) {
    try {
      finalBuffer = await compositeLogoOnImage(resizedBuffer, brand.logoUrl);
      console.log(`[imageGen] Logo composited on product post | elapsed=${elapsed(startedAt)}s`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error(`[imageGen] Logo compositing failed on product post | ${e.message}`);
      finalBuffer = resizedBuffer;
    }
  }

  const imageUrl = await uploadBufferToCloudinary(finalBuffer, "brandefai/product-posts");
  console.log(`[imageGen] Product post DONE | elapsed=${elapsed(startedAt)}s | ${imageUrl}`);

  const record = await prisma.generatedImage.create({
    data: {
      userId,
      brandId,
      originalPrompt: brief.postTitle,
      enhancedPrompt: prompt,
      imageUrl,
      style: "photorealistic",
      format: "4:5",
      source: ImageSource.GENERATED,
      postBriefId: briefId,
    },
  });

  await deductCredits(prisma, userId, 5, CreditType.GENERATION, record.id);

  return { imageId: record.id, imageUrl };
}

// ─── deleteCloudinaryImage ────────────────────────────────────────────────────

function extractPublicId(url: string): string | null {
  const idx = url.indexOf("/upload/");
  if (idx === -1) return null;
  let after = url.slice(idx + 8).replace(/^v\d+\//, "");
  const dot = after.lastIndexOf(".");
  return dot !== -1 ? after.slice(0, dot) : after;
}

export async function deleteCloudinaryImage(imageUrl: string): Promise<void> {
  const publicId = extractPublicId(imageUrl);
  if (!publicId) {
    console.warn(`[imageGen] Could not extract public_id from URL: ${imageUrl}`);
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log(`[imageGen] Cloudinary deleted | ${publicId}`);
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error(`[imageGen] Cloudinary delete failed | ${publicId} | ${e.message}`);
  }
}
