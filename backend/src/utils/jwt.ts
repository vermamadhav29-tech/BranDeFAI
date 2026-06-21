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

// Short-lived token used only to bridge the OAuth redirect → frontend exchange POST.
// 2-minute TTL; contains a type discriminant so it cannot be used as a session token.
export function signExchangeToken(userId: string): string {
  return jwt.sign({ userId, type: "oauth_exchange" }, process.env.JWT_SECRET as string, {
    expiresIn: "2m",
  });
}

export function verifyExchangeToken(token: string): { userId: string } {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
      type: string;
    };
    if (payload.type !== "oauth_exchange") throw new Error("wrong type");
    return { userId: payload.userId };
  } catch {
    throw createError("Invalid or expired exchange token", 401);
  }
}
