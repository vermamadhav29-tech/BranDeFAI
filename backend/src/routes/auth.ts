import { Router } from "express";
import { register, login, logout, me } from "../controllers/authController";
import { googleRedirect, googleCallback } from "../controllers/googleAuthController";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { registerSchema, loginSchema } from "../middleware/validators/authSchemas";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);

// Google OAuth — full-page redirects, no body/cookie auth needed
router.get("/google", googleRedirect);
router.get("/google/callback", googleCallback);

export default router;
