import { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data, error: null });
}

export function sendError(res: Response, error: string, statusCode = 400): void {
  res.status(statusCode).json({ success: false, data: null, error });
}
