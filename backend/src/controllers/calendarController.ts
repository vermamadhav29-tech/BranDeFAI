import { Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import * as calendarService from "../services/calendarService";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";
import type { AutoAssignInput, CreateEntryInput, UpdateEntryInput } from "../middleware/validators/calendarSchemas";

// ─── POST /api/calendar/auto-assign ───────────────────────────────────────────

export async function autoAssign(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const brand = await prisma.brand.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!brand) return next(createError("Brand not found. Set up your brand first.", 404));

    const { contentBatchId } = req.body as AutoAssignInput;
    const entries = await calendarService.autoAssignContent(req.user!.id, brand.id, contentBatchId);
    sendSuccess(res, { entries, count: entries.length }, 201);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/calendar/entry ──────────────────────────────────────────────────

export async function createEntry(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const brand = await prisma.brand.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!brand) return next(createError("Brand not found. Set up your brand first.", 404));

    const { calendarDay, month, year, contentType, contentId, notes } =
      req.body as CreateEntryInput;

    const entry = await prisma.calendarEntry.create({
      data: {
        userId: req.user!.id,
        brandId: brand.id,
        calendarDay,
        month,
        year,
        contentType,
        contentId,
        ...(notes && { notes }),
      },
    });

    sendSuccess(res, entry, 201);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/calendar ─────────────────────────────────────────────────────────

export async function getCalendar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const now = new Date();
    const month = Math.max(1, Math.min(12, parseInt(req.query.month as string) || now.getMonth() + 1));
    const year = parseInt(req.query.year as string) || now.getFullYear();

    const entries = await calendarService.getCalendar(req.user!.id, month, year);
    sendSuccess(res, { entries, month, year });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/calendar/stats ───────────────────────────────────────────────────

export async function getStats(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const now = new Date();
    const month = Math.max(1, Math.min(12, parseInt(req.query.month as string) || now.getMonth() + 1));
    const year = parseInt(req.query.year as string) || now.getFullYear();

    const filledDays = await prisma.calendarEntry.count({
      where: { userId: req.user!.id, month, year },
    });

    sendSuccess(res, { filledDays, totalDays: 30, month, year });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/calendar/entry/:id ───────────────────────────────────────────────

export async function updateEntry(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const entry = await prisma.calendarEntry.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
    });
    if (!entry) return next(createError("Calendar entry not found", 404));

    const { notes, status, calendarDay } = req.body as UpdateEntryInput;
    const updated = await prisma.calendarEntry.update({
      where: { id: entry.id },
      data: {
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
        ...(calendarDay && { calendarDay }),
      },
    });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/calendar/entry/:id ───────────────────────────────────────────

export async function deleteEntry(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const entry = await prisma.calendarEntry.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
    });
    if (!entry) return next(createError("Calendar entry not found", 404));

    await prisma.calendarEntry.delete({ where: { id: entry.id } });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/calendar/export/pdf ─────────────────────────────────────────────

export async function downloadPDF(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const now = new Date();
    const month = Math.max(1, Math.min(12, parseInt(req.query.month as string) || now.getMonth() + 1));
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });

    const buffer = await calendarService.exportPDF(req.user!.id, month, year);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="calendar-${monthName}-${year}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/calendar/export/csv ─────────────────────────────────────────────

export async function downloadCSV(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const now = new Date();
    const month = Math.max(1, Math.min(12, parseInt(req.query.month as string) || now.getMonth() + 1));
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });

    const csv = await calendarService.exportCSV(req.user!.id, month, year);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="calendar-${monthName}-${year}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
