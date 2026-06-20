import jwt from "jsonwebtoken";
import { createError } from "../middleware/errorHandler";

export function signToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): { userId: string } {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    return { userId: payload.userId };
  } catch {
    throw createError("Invalid or expired token", 401);
  }
}
