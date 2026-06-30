import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generateImageSchema, generatePostBriefsSchema, generateProductPostsSchema, lifestyleImageSchema } from "../middleware/validators/imageSchemas";
import { generateImage, listImages, countImages, deleteImage, generatePostBriefs, listPostBriefs, generateProductPosts, generateLifestyleImage } from "../controllers/imagesController";

const router = Router();

router.use(authMiddleware);

// 120s socket timeout for image generation — gpt-image-1 can take 15-30s
function generationTimeout(_req: Request, res: Response, next: NextFunction): void {
  res.setTimeout(120_000, () => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        data: null,
        error: "Image generation timed out. Please try again.",
      });
    }
  });
  next();
}

// 150s socket timeout — Flux 2 Pro polling alone can take up to 2 minutes
function fluxTimeout(_req: Request, res: Response, next: NextFunction): void {
  res.setTimeout(150_000, () => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        data: null,
        error: "Image generation timed out. Please try again.",
      });
    }
  });
  next();
}

router.post("/generate", generationTimeout, validate(generateImageSchema), generateImage);
router.post("/generate-post-briefs", validate(generatePostBriefsSchema), generatePostBriefs);
router.post("/generate-product-posts", generationTimeout, validate(generateProductPostsSchema), generateProductPosts);
router.post("/lifestyle", fluxTimeout, validate(lifestyleImageSchema), generateLifestyleImage);

// Static routes before /:id
router.get("/count", countImages);
router.get("/", listImages);
router.get("/post-briefs", listPostBriefs);

router.delete("/:id", deleteImage);

export default router;
