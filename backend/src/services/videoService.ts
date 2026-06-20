import { VideoStatus } from "@prisma/client";
import prisma from "../utils/prisma";
import { createError } from "../middleware/errorHandler";
import { videoQueue } from "../jobs/queueConfig";

export interface TimelineClip {
  id: string;
  sourceUrl: string;
  duration: number;
  transitionType?: "crossfade" | "none";
}

// ─── createProject ────────────────────────────────────────────────────────────

export async function createProject(userId: string, brandId: string, title: string) {
  return prisma.videoProject.create({
    data: {
      userId,
      brandId,
      title,
      timelineData: [] as unknown as object,
      status: VideoStatus.DRAFT,
    },
  });
}

// ─── saveTimeline ─────────────────────────────────────────────────────────────

export async function saveTimeline(
  projectId: string,
  userId: string,
  clips: TimelineClip[]
) {
  const project = await prisma.videoProject.findFirst({ where: { id: projectId, userId } });
  if (!project) throw createError("Video project not found", 404);

  if (project.status === VideoStatus.PROCESSING) {
    throw createError("Cannot edit timeline while export is in progress", 409);
  }

  return prisma.videoProject.update({
    where: { id: projectId },
    data: {
      timelineData: clips as unknown as object,
      // Reset to DRAFT if they edit the timeline after a completed export
      status: VideoStatus.DRAFT,
      exportUrl: null,
    },
  });
}

// ─── queueExport ──────────────────────────────────────────────────────────────

export async function queueExport(projectId: string, userId: string) {
  const project = await prisma.videoProject.findFirst({ where: { id: projectId, userId } });
  if (!project) throw createError("Video project not found", 404);

  const clips = project.timelineData as unknown as TimelineClip[];
  if (!Array.isArray(clips) || clips.length === 0) {
    throw createError("Timeline is empty. Add at least one clip before exporting.", 422);
  }

  if (project.status === VideoStatus.PROCESSING) {
    throw createError("Export already in progress", 409);
  }

  // Credit check happens in controller before calling this function.
  // Update status to PROCESSING before enqueueing so the client sees it immediately.
  await prisma.videoProject.update({
    where: { id: projectId },
    data: { status: VideoStatus.PROCESSING, exportUrl: null },
  });

  await videoQueue.add("export", { projectId, userId }, { jobId: projectId });

  return { queued: true };
}
