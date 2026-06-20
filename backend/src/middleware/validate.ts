import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const message = err.issues.map((e: any) => `${(e.path as PropertyKey[]).join(".")}: ${e.message}`).join("; ");
        res.status(400).json({ success: false, data: null, error: message });
        return;
      }
      next(err);
    }
  };
}
