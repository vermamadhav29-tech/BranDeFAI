import PDFDocument from "pdfkit";
import prisma from "../utils/prisma";
import { createError } from "../middleware/errorHandler";
import { ContentType } from "@prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// CAPTION and REEL_IDEA need an index into their arrays; encode as "{id}::{index}".
// AD_COPY and IMAGE use the bare ID.
function encodeContentId(id: string, index: number): string {
  return `${id}::${index}`;
}

function parseContentId(encoded: string): { id: string; index: number } {
  const sep = encoded.indexOf("::");
  if (sep === -1) return { id: encoded, index: 0 };
  return { id: encoded.slice(0, sep), index: parseInt(encoded.slice(sep + 2), 10) || 0 };
}

function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const raw = text.match(/#[a-zA-Z0-9_]+/g) ?? [];
  return [...new Set(raw.map((h) => h.toLowerCase()))].slice(0, 5);
}

function getSuggestedTime(contentType: ContentType): string {
  const map: Partial<Record<ContentType, string>> = {
    CAPTION:   "9:00 AM",
    REEL_IDEA: "7:00 PM",
    AD_COPY:   "12:00 PM",
    IMAGE:     "11:00 AM",
    VIDEO:     "8:00 PM",
  };
  return map[contentType] ?? "9:00 AM";
}

// ─── Assignment schedule ───────────────────────────────────────────────────────

const SCHEDULE: Array<{ day: number; type: ContentType; index: number; isImage: boolean }> = [
  { day: 1,  type: "CAPTION",   index: 0, isImage: false },
  { day: 3,  type: "REEL_IDEA", index: 0, isImage: false },
  { day: 5,  type: "CAPTION",   index: 1, isImage: false },
  { day: 8,  type: "IMAGE",     index: 0, isImage: true  },
  { day: 10, type: "AD_COPY",   index: 0, isImage: false },
  { day: 13, type: "CAPTION",   index: 2, isImage: false },
  { day: 15, type: "REEL_IDEA", index: 1, isImage: false },
  { day: 18, type: "IMAGE",     index: 1, isImage: true  },
];

// ─── autoAssignContent ─────────────────────────────────────────────────────────

export async function autoAssignContent(
  userId: string,
  brandId: string,
  contentBatchId: string
) {
  const [content, brand] = await Promise.all([
    prisma.generatedContent.findFirst({
      where: { id: contentBatchId, userId },
      include: { productImage: { select: { imageUrl: true } } },
    }),
    prisma.brand.findUnique({
      where: { id: brandId },
      select: { targetAudience: true },
    }),
  ]);
  if (!content) throw createError("Content batch not found", 404);

  // Fetch up to 2 most recent unassigned generated images for this user
  const images = await prisma.generatedImage.findMany({
    where: { userId, calendarAssigned: false },
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const existing = await prisma.calendarEntry.findMany({
    where: { userId, month, year },
    select: { calendarDay: true },
  });
  const occupiedDays = new Set(existing.map((e) => e.calendarDay));

  function nextFreeDay(preferred: number): number {
    let d = preferred;
    while (d <= 31 && occupiedDays.has(d)) d++;
    return d;
  }

  // Pull shared metadata from the content batch
  const captions = content.captions as string[];
  const reelIdeas = content.reelIdeas as Array<{
    hook: string;
    shotList: string[];
    audioType?: string;
    duration?: string;
    caption?: string;
  }>;
  const adCopyData = content.adCopy as { keywords?: string[] } | null;
  const contentKeywords: string[] = adCopyData?.keywords ?? [];
  const productImageUrl: string | null = content.productImage?.imageUrl ?? null;

  const toCreate: Array<Parameters<typeof prisma.calendarEntry.create>[0]["data"]> = [];

  for (const slot of SCHEDULE) {
    if (slot.isImage && images.length <= slot.index) continue;

    const day = nextFreeDay(slot.day);
    if (day > 31) continue;

    const contentId = slot.isImage
      ? images[slot.index].id
      : slot.type === "AD_COPY"
        ? content.id
        : encodeContentId(content.id, slot.index);

    let entryHashtags: string[] = [];
    let entryAssetUrl: string | undefined;
    let entryNotes: string | undefined;

    if (slot.type === "CAPTION") {
      entryHashtags = extractHashtags(captions[slot.index]);
      entryAssetUrl = productImageUrl ?? images[0]?.imageUrl ?? undefined;
    } else if (slot.type === "REEL_IDEA") {
      entryHashtags = extractHashtags(reelIdeas[slot.index]?.caption);
    } else if (slot.type === "AD_COPY") {
      // Store brand target audience in notes so the preview panel can show it
      entryNotes = brand?.targetAudience ?? undefined;
    } else if (slot.type === "IMAGE") {
      entryAssetUrl = images[slot.index]?.imageUrl ?? undefined;
    }

    toCreate.push({
      userId,
      brandId,
      calendarDay: day,
      month,
      year,
      contentType: slot.type,
      contentId,
      hashtags: entryHashtags,
      keywords: contentKeywords,
      suggestedTime: getSuggestedTime(slot.type),
      ...(entryAssetUrl !== undefined && { assetUrl: entryAssetUrl }),
      ...(entryNotes !== undefined && { notes: entryNotes }),
    });

    occupiedDays.add(day);
  }

  const created = await prisma.$transaction(
    toCreate.map((data) => prisma.calendarEntry.create({ data }))
  );

  await prisma.generatedContent.update({
    where: { id: content.id },
    data: { calendarAssigned: true },
  });

  const imageIds = images.slice(0, 2).map((img) => img.id);
  if (imageIds.length > 0) {
    await prisma.generatedImage.updateMany({
      where: { id: { in: imageIds } },
      data: { calendarAssigned: true },
    });
  }

  return created;
}

// ─── getCalendar ───────────────────────────────────────────────────────────────

export async function getCalendar(userId: string, month: number, year: number) {
  const entries = await prisma.calendarEntry.findMany({
    where: { userId, month, year },
    orderBy: { calendarDay: "asc" },
  });

  const contentIds = new Set<string>();
  const imageIds = new Set<string>();

  for (const entry of entries) {
    if (entry.contentType === "IMAGE") {
      imageIds.add(entry.contentId);
    } else {
      contentIds.add(parseContentId(entry.contentId).id);
    }
  }

  const [contentRecords, imageRecords] = await Promise.all([
    contentIds.size > 0
      ? prisma.generatedContent.findMany({ where: { id: { in: [...contentIds] } } })
      : [],
    imageIds.size > 0
      ? prisma.generatedImage.findMany({ where: { id: { in: [...imageIds] } } })
      : [],
  ]);

  const contentMap = new Map(contentRecords.map((c) => [c.id, c]));
  const imageMap = new Map(imageRecords.map((i) => [i.id, i]));

  return entries.map((entry) => {
    let preview: unknown = null;

    if (entry.contentType === "IMAGE") {
      const img = imageMap.get(entry.contentId);
      if (img) preview = { imageUrl: img.imageUrl, style: img.style, format: img.format };
    } else {
      const { id, index } = parseContentId(entry.contentId);
      const c = contentMap.get(id);
      if (c) {
        if (entry.contentType === "CAPTION") {
          const captions = c.captions as string[];
          preview = captions[index] ?? captions[0] ?? null;
        } else if (entry.contentType === "REEL_IDEA") {
          const reelIdeas = c.reelIdeas as Array<{
            hook: string;
            shotList: string[];
            audioType?: string;
            duration?: string;
            caption?: string;
          }>;
          preview = reelIdeas[index] ?? reelIdeas[0] ?? null;
        } else if (entry.contentType === "AD_COPY") {
          preview = c.adCopy;
        }
      }
    }

    return { ...entry, preview };
  });
}

// ─── exportCSV ─────────────────────────────────────────────────────────────────

export async function exportCSV(userId: string, month: number, year: number): Promise<string> {
  const entries = await getCalendar(userId, month, year);

  const rows: string[][] = [
    ["Day", "Type", "Content", "Status", "Hashtags", "Keywords", "Suggested Time"],
  ];

  for (const entry of entries) {
    let content = "";
    if (entry.contentType === "IMAGE") {
      const p = entry.preview as { imageUrl: string } | null;
      content = p?.imageUrl ?? "";
    } else if (entry.contentType === "CAPTION") {
      content = typeof entry.preview === "string" ? entry.preview : "";
    } else if (entry.contentType === "AD_COPY") {
      const p = entry.preview as { headline: string; body: string; cta: string } | null;
      content = p ? `${p.headline} — ${p.body}` : "";
    } else if (entry.contentType === "REEL_IDEA") {
      const p = entry.preview as { hook: string } | null;
      content = p?.hook ?? "";
    }

    rows.push([
      String(entry.calendarDay),
      entry.contentType,
      `"${content.replace(/"/g, '""')}"`,
      entry.status,
      `"${(entry.hashtags ?? []).join(" ")}"`,
      `"${(entry.keywords ?? []).join(", ")}"`,
      entry.suggestedTime ?? "",
    ]);
  }

  return rows.map((r) => r.join(",")).join("\n");
}

// ─── exportPDF ─────────────────────────────────────────────────────────────────

export async function exportPDF(userId: string, month: number, year: number): Promise<Buffer> {
  const entries = await getCalendar(userId, month, year);
  const brand = await prisma.brand.findFirst({ where: { userId } });

  const dayMap = new Map(entries.map((e) => [e.calendarDay, e]));
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });

  const TYPE_COLORS: Record<string, string> = {
    CAPTION: "#1A7A4A",
    REEL_IDEA: "#2563EB",
    AD_COPY: "#9333EA",
    IMAGE: "#EA580C",
    VIDEO: "#DC2626",
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 36;
    const usableW = pageW - margin * 2;
    const headerH = 64;

    // Header background
    doc.rect(0, 0, pageW, headerH).fill("#1A2E44");

    doc.fontSize(16).fillColor("#FFFFFF")
      .text(brand?.brandName ?? "Brand", margin, 14, { width: usableW, align: "center" });

    doc.fontSize(11).fillColor("#86EFAC")
      .text(`${monthName} ${year} — Content Calendar`, margin, 38, { width: usableW, align: "center" });

    const cols = 6;
    const rows = 5;
    const cellW = usableW / cols;
    const cellH = (pageH - margin - headerH - 4) / rows;

    for (let day = 1; day <= 30; day++) {
      const col = (day - 1) % cols;
      const row = Math.floor((day - 1) / cols);
      const x = margin + col * cellW;
      const y = headerH + 4 + row * cellH;

      doc.rect(x, y, cellW, cellH).fillAndStroke(row % 2 === 0 ? "#FAFAFA" : "#FFFFFF", "#E5E7EB");

      doc.fontSize(7).fillColor("#9CA3AF")
        .text(String(day), x + 4, y + 3, { width: 20 });

      const entry = dayMap.get(day);
      if (entry) {
        const color = TYPE_COLORS[entry.contentType] ?? "#6B7280";
        const label = entry.contentType.replace("_", " ");

        doc.fontSize(6).fillColor(color)
          .text(label, x + 4, y + 14, { width: cellW - 8 });

        let previewText = "";
        if (entry.contentType === "IMAGE") {
          previewText = "📷 Image";
        } else if (typeof entry.preview === "string") {
          previewText = entry.preview.slice(0, 80);
        } else if (entry.preview && typeof entry.preview === "object") {
          const p = entry.preview as Record<string, unknown>;
          previewText = String(p.hook ?? p.headline ?? "").slice(0, 80);
        }

        doc.fontSize(5.5).fillColor("#374151")
          .text(previewText, x + 4, y + 24, { width: cellW - 8, height: cellH - 44, ellipsis: true });

        // Hashtags row
        const tags = (entry.hashtags ?? []).slice(0, 3).join(" ");
        if (tags) {
          doc.fontSize(4.5).fillColor("#1A7A4A")
            .text(tags, x + 4, y + cellH - 18, { width: cellW - 8, ellipsis: true });
        }
      }
    }

    // Legend
    const legendY = pageH - margin + 4;
    let legendX = margin;
    for (const [type, color] of Object.entries(TYPE_COLORS)) {
      if (type === "VIDEO") continue;
      doc.rect(legendX, legendY, 8, 8).fill(color);
      doc.fontSize(6).fillColor("#374151").text(type.replace("_", " "), legendX + 10, legendY + 1);
      legendX += 80;
    }

    doc.end();
  });
}
