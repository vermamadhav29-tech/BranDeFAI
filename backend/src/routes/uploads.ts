import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/auth";
import { uploadProductImage, uploadVideoClip, uploadBrandLogo, bulkUploadProductImages, listProductImages } from "../controllers/uploadController";
import { createError } from "../middleware/errorHandler";

const router = Router();

const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError("Only JPEG, PNG, and WebP images are accepted", 400));
    }
  },
});

const CLIP_ALLOWED_MIMES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
  "image/jpeg",
  "image/png",
];

const clipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB for video clips
  fileFilter: (_req, file, cb) => {
    console.log(`[upload-clip] fileFilter: name=${file.originalname} mime=${file.mimetype}`);
    if (CLIP_ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError(`Unsupported file type: ${file.mimetype}. Accepted: MP4, MOV, WebM, JPG, PNG`, 400));
    }
  },
});

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError("Only PNG, SVG, JPEG, and WebP are accepted for logos", 400));
    }
  },
});

const bulkProductImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError("Only JPEG, PNG, and WebP images are accepted", 400));
    }
  },
});

router.get("/product-images",  authMiddleware, listProductImages);
router.post("/product-image", authMiddleware, productImageUpload.single("image"), uploadProductImage);
router.post("/bulk-product-images", authMiddleware, bulkProductImageUpload.array("images", 15), bulkUploadProductImages);
router.post("/brand-logo", authMiddleware, logoUpload.single("logo"), uploadBrandLogo);
router.post("/video-clip", authMiddleware, clipUpload.single("video"), uploadVideoClip);

export default router;
