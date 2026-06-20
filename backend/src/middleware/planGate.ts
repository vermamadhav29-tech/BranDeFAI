import { Response, NextFunction } from "express";
import { Plan } from "@prisma/client";
import { AuthRequest } from "./auth";
import { createError } from "./errorHandler";

export function requirePlan(...allowedPlans: Plan[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(createError("Unauthorized", 401));
    if (!allowedPlans.includes(req.user.plan)) {
      return next(
        createError(
          `This feature requires a ${allowedPlans.join(" or ")} plan. Upgrade at /pricing.`,
          403
        )
      );
    }
    next();
  };
}
