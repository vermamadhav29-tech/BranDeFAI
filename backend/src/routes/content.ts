import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generateContentSchema, regenerateCaptionSchema } from "../middleware/validators/contentSchemas";
import {
  generateContent,
  listContent,
  countContent,
  getLatestContent,
  getContent,
  regenerateCaption,
  getNextCaptionAlternate,
  regenerateAdCopy,
} from "../controllers/contentController";

const router = Router();

router.use(authMiddleware);

// 120s socket timeout for the generate route — gpt-image-1 runs 2 images in parallel (15-30s each)
function generationTimeout(_req: Request, res: Response, next: NextFunction): void {
  res.setTimeout(120_000, () => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        data: null,
        error: "Content generation timed out. Please try again.",
      });
    }
  });
  next();
}

// Static routes must come before /:id to avoid param collision
router.get("/count", countContent);
router.get("/latest", getLatestContent);
router.get("/", listContent);

router.post("/generate", generationTimeout, validate(generateContentSchema), generateContent);

router.get("/:id", getContent);
router.post("/:id/regenerate-caption", validate(regenerateCaptionSchema), regenerateCaption);
router.post("/:id/caption/next-alternate", getNextCaptionAlternate);
router.post("/:id/regenerate-adcopy", regenerateAdCopy);

export default router;
