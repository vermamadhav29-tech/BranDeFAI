/**
 * studioTest.routes.ts
 *
 * Self-contained route file for the isolated studio-test pipeline.
 * No auth middleware — this is a dev/test endpoint.
 * Imports NOTHING from the existing service layer.
 */

import { Router } from "express";
import multer from "multer";
import { handleStudioTestGenerate } from "../studio-test/studioTest.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are accepted"));
    }
  },
});

router.post(
  "/generate",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "logo",  maxCount: 1 }, // optional — overlaid on composited output only
  ]),
  handleStudioTestGenerate,
);

export default router;
