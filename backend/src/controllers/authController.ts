import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/prisma";
import { signToken, verifyExchangeToken } from "../utils/jwt";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";
import { COOKIE_NAME, COOKIE_OPTIONS } from "../utils/cookies";

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

// Completes Google OAuth: frontend POSTs the short-lived exchange token from the
// redirect URL, we verify it and set the real session cookie — identical to login().
export async function exchange(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body as { token?: string };
    if (!token) return next(createError("Exchange token required", 400));

    const { userId } = verifyExchangeToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, plan: true, creditsBalance: true },
    });
    if (!user) return next(createError("User not found", 401));

    console.log(`[auth/exchange] userId=${user.id} plan=${user.plan}`);
    res.cookie(COOKIE_NAME, signToken(user.id), COOKIE_OPTIONS);
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
