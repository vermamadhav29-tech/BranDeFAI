import { Router } from "express";
import { Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { generateStrategy, approveStrategy } from "../services/strategyService";
import { deductCredits } from "../utils/creditUtils";
import { createVideoProject, generateSceneMedia, getVideoProject, getStrategyProjects, suggestTransitions, compileProject, type TransitionSuggestion } from "../services/sceneService";
import prisma from "../utils/prisma";

const router = Router();
router.use(authMiddleware);

// GET /api/strategy — return saved strategyData for the authenticated user's brand
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brand = await prisma.brand.findUnique({
      where: { userId: req.user!.id },
      select: { strategyData: true, strategyApproved: true },
    });

    if (!brand) return next(createError("Brand not found", 404));

    sendSuccess(res, brand);
  } catch (err) {
    next(err);
  }
});

// POST /api/strategy/generate — deduct 5 credits, then generate AI strategy (does NOT save)
router.post("/generate", async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;

    if (user.creditsBalance < 5) {
      return next(createError("Insufficient credits — strategy generation costs 5 credits", 402));
    }

    const brand = await prisma.brand.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!brand) return next(createError("Brand not found", 404));

    const strategy = await generateStrategy(user.id);

    // Deduct after successful generation so a failed OpenAI call never costs credits
    await deductCredits(prisma, user.id, 5, "STRATEGY", brand.id);

    sendSuccess(res, strategy);
  } catch (err) {
    next(err);
  }
});

// POST /api/strategy/approve — save strategy and mark approved (credits already deducted at generate time)
router.post("/approve", async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const strategyData = req.body;

    if (!strategyData || !strategyData.contentPillars || !strategyData.hookFrameworks) {
      return next(createError("Invalid strategy data", 400));
    }

    const brand = await approveStrategy(req.user!.id, strategyData);
    sendSuccess(res, brand);
  } catch (err) {
    next(err);
  }
});

// POST /api/strategy/create-project — create VideoProject + VideoScene records for a video idea
router.post("/create-project", async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { videoIdeaIndex } = req.body;
    if (typeof videoIdeaIndex !== "number") {
      return next(createError("videoIdeaIndex must be a number", 400));
    }
    const result = await createVideoProject(req.user!.id, videoIdeaIndex);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /api/strategy/project/:videoIdeaIndex — fetch existing project for a video idea
router.get("/project/:videoIdeaIndex", async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idx = parseInt(req.params.videoIdeaIndex as string, 10);
    if (isNaN(idx)) return next(createError("Invalid videoIdeaIndex", 400));
    const project = await getVideoProject(req.user!.id, idx);
    sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
});

// POST /api/strategy/generate-scene — generate image + clip for one scene
// Takes ~2-3 minutes per scene; socket timeout set to 7 minutes.
router.post("/generate-scene", async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  res.setTimeout(420_000, () => {
    next(createError("Scene generation timed out — try again", 504));
  });

  try {
    const { sceneId } = req.body;
    if (!sceneId || typeof sceneId !== "string") {
      return next(createError("sceneId is required", 400));
    }
    const result = await generateSceneMedia(req.user!.id, sceneId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /api/strategy/projects-with-scenes — all strategy VideoProjects with ≥1 DONE scene
router.get("/projects-with-scenes", async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projects = await getStrategyProjects(req.user!.id);
    sendSuccess(res, projects);
  } catch (err) {
    next(err);
  }
});

// GET /api/strategy/suggest-transitions/:projectId — GPT-4o transition suggestions
router.get("/suggest-transitions/:projectId", async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const suggestions = await suggestTransitions(req.params.projectId as string, req.user!.id);
    sendSuccess(res, { transitions: suggestions });
  } catch (err) {
    next(err);
  }
});

// POST /api/strategy/compile/:projectId — AI-suggested (or caller-provided) xfade stitching
router.post("/compile/:projectId", async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  res.setTimeout(300_000, () => {
    next(createError("Compile timed out — try again", 504));
  });

  try {
    const { projectId } = req.params;
    const { transitions } = req.body as { transitions?: TransitionSuggestion[] };
    const result = await compileProject(req.user!.id, projectId as string, transitions);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
