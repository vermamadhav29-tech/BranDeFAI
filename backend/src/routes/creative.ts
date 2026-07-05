import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { generatePostSchema, updatePostStatusSchema, updatePostCaptionSchema } from "../middleware/validators/creativeSchemas";
import {
  triggerGenerate,
  listPosts,
  updatePostStatus,
  updatePostCaption,
  deletePost,
  listOccasions,
} from "../controllers/creativeController";

const router = Router();

router.use(authMiddleware);

router.post("/generate",       validate(generatePostSchema),      triggerGenerate);
router.get("/posts",           listPosts);
router.get("/occasions",       listOccasions);
router.patch("/posts/:id/status",  validate(updatePostStatusSchema),  updatePostStatus);
router.patch("/posts/:id/caption", validate(updatePostCaptionSchema), updatePostCaption);
router.delete("/posts/:id",    deletePost);

export default router;
