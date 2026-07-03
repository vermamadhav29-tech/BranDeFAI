import { Router } from "express";
import { createBrand, getBrand, updateBrand, updateLogoUrl, generateBrandField, regenerateVoiceSummary, refreshBrandDNA, extractBrandColor } from "../controllers/brandController";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { brandSchema, logoUrlSchema, generateFieldSchema } from "../middleware/validators/brandSchemas";

const router = Router();

router.use(authMiddleware);

router.post("/", validate(brandSchema), createBrand);
router.get("/", getBrand);
router.put("/", validate(brandSchema), updateBrand);
router.patch("/logo", validate(logoUrlSchema), updateLogoUrl);
router.post("/extract-color", extractBrandColor);
router.post("/generate-field", validate(generateFieldSchema), generateBrandField);
router.post("/regenerate-voice", regenerateVoiceSummary);
router.post("/refresh-dna", refreshBrandDNA);

export default router;
