import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { requirePlan } from "../middleware/planGate";
import {
  createProjectSchema,
  saveTimelineSchema,
  generateClipSchema,
} from "../middleware/validators/videoSchemas";
import {
  createVideoProject,
  listVideoProjects,
  getVideoProject,
  updateTimeline,
  exportVideo,
  getExportStatus,
  generateVideoClip,
} from "../controllers/videosController";

const router = Router();

router.use(authMiddleware);

// Project CRUD (gated — PRO/BUSINESS only)
router.post("/", requirePlan("PRO", "BUSINESS"), validate(createProjectSchema), createVideoProject);
router.get("/", listVideoProjects);

// Sub-resource routes before /:id to avoid conflicts
router.put("/:id/timeline", requirePlan("PRO", "BUSINESS"), validate(saveTimelineSchema), updateTimeline);
router.post("/:id/export", requirePlan("PRO", "BUSINESS"), exportVideo);
router.get("/:id/export-status", getExportStatus);
router.post("/:id/generate-clip", requirePlan("PRO", "BUSINESS"), validate(generateClipSchema), generateVideoClip);

// Single project (after specific sub-routes)
router.get("/:id", getVideoProject);

export default router;
