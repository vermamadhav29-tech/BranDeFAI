import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import prisma from "../utils/prisma";
import { createError } from "./errorHandler";
import { Plan } from "@prisma/client";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    plan: Plan;
    creditsBalance: number;
    createdAt: Date;
    updatedAt: Date;
  };
}

export async function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.brandefai_token;

  if (!token) {
    return next(createError("Unauthorized", 401));
  }

  try {
    const { userId } = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        creditsBalance: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return next(createError("User not found", 401));
    }

    req.user = user;
    next();
  } catch (err: any) {
    next(createError(err.message || "Invalid or expired token", 401));
  }
}
