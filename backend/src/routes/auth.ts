import { Router } from "express";
import { register, login, logout, me } from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { registerSchema, loginSchema } from "../middleware/validators/authSchemas";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);

export default router;
