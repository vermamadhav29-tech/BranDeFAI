import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/prisma";
import { signToken } from "../utils/jwt";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";

const COOKIE_NAME = "brandefai_token";
// Cross-domain (Vercel ↔ Railway): sameSite must be "none" + secure in production.
// Locally: "lax" works fine and avoids needing HTTPS.
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export async function register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return next(createError("Email already in use", 409));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, plan: true },
    });

    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    sendSuccess(res, { userId: user.id, email: user.email, plan: user.plan }, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return next(createError("Invalid credentials", 401));
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return next(createError("Invalid credentials", 401));
    }

    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    sendSuccess(res, {
      userId: user.id,
      email: user.email,
      plan: user.plan,
      creditsBalance: user.creditsBalance,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: AuthRequest, res: Response): Promise<void> {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  sendSuccess(res, null);
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  console.log(`[auth/me] userId=${req.user?.id} plan=${req.user?.plan} creditsBalance=${req.user?.creditsBalance}`);
  sendSuccess(res, req.user);
}
