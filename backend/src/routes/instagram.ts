import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { requirePlan } from "../middleware/planGate";

const router = Router();

router.use(authMiddleware);
router.use(requirePlan("PRO", "BUSINESS"));

// TODO: GET /auth, GET /callback, POST /post, GET /accounts
export default router;
