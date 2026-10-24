import { Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import { sendSuccess } from "../utils/response";
import { createError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";
import { generateText } from "../services/ai/openaiService";
import { generateBrandDNA, extractGoogleBusinessData, isGoogleBusinessUrl } from "../services/brandDNA.service";
import { extractBrandColorFromLogo } from "../services/promoCreative.service";
import type { BrandInput, LogoUrlInput, GenerateFieldInput } from "../middleware/validators/brandSchemas";

// ─── Voice Summary Helper ─────────────────────────────────────────────────────

async function generateVoiceSummaryText(brand: {
  brandName: string;
  industry: string;
  tone: string;
  targetAudience: string;
  brandBrief?: string | null;
  platforms?: string[];
}): Promise<string> {
  const platformsStr = brand.platforms?.length ? `Sells on: ${brand.platforms.join(", ")}.` : "";
  const system =
    "You are a brand voice strategist. Return only the requested text — no labels, no bullet points, no headings, no preamble.";
  const user = [
    `Write a 200-word brand voice summary for ${brand.brandName}, a ${brand.industry} brand with a ${brand.tone} tone.`,
    `Target audience: ${brand.targetAudience}.`,
    platformsStr,
    brand.brandBrief ? `Brand brief: ${brand.brandBrief}.` : "",
    `Write as a single flowing paragraph. Describe who the brand speaks to, how it speaks, what language it uses, what it never does, and what emotional register it hits. Be specific, vivid, and concrete — not generic. Aim for 180-200 words.`,
  ]
    .filter(Boolean)
    .join("\n");
  return (await generateText(system, user)) as string;
}

export async function createBrand(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const existing = await prisma.brand.findUnique({ where: { userId } });
    if (existing) {
      return next(createError("Brand already exists for this account", 409));
    }

    const { brandName, industry, targetAudience, tone, platforms, brandBrief, whatTheySell, city, logoUrl, instagramUrl, websiteUrl, googleBusinessUrl } = req.body as BrandInput;

    const brand = await prisma.brand.create({
      data: {
        userId,
        brandName,
        industry,
        targetAudience,
        tone,
        platforms: platforms ?? [],
        brandBrief: brandBrief ?? null,
        whatTheySell: whatTheySell ?? brandBrief ?? null,
        city: city ?? null,
        logoUrl: logoUrl ?? null,
        instagramUrl: instagramUrl ?? null,
        websiteUrl: websiteUrl ?? null,
        googleBusinessUrl: googleBusinessUrl ?? null,
      },
    });

    // Fire-and-forget — generate voice summary in background without blocking onboarding
    generateVoiceSummaryText(brand)
      .then((summary) =>
        prisma.brand.update({ where: { id: brand.id }, data: { voiceSummary: summary.trim() } })
      )
      .catch(() => {});

    // Fire-and-forget — extract Google Business data (if provided), then generate Brand DNA.
    (async () => {
      let googleBusinessData;
      if (googleBusinessUrl && isGoogleBusinessUrl(googleBusinessUrl)) {
        googleBusinessData = await extractGoogleBusinessData(googleBusinessUrl).catch(() => ({}));
        if (googleBusinessData && Object.values(googleBusinessData).some(Boolean)) {
          await prisma.brand.update({
            where: { id: brand.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { googleBusinessData: JSON.parse(JSON.stringify(googleBusinessData)) as any },
          }).catch(() => {});
        }
      }

      const dna = await generateBrandDNA(
        {
          brandName: brand.brandName,
          whatTheySell: brand.whatTheySell,
          brandBrief: brand.brandBrief,
          industry: brand.industry,
          brandVibe: brand.tone,
          url: instagramUrl ?? websiteUrl ?? undefined,
          googleBusinessUrl: googleBusinessUrl ?? undefined,
        },
        googleBusinessData
      );
      await prisma.brand.update({
        where: { id: brand.id },
        data: { brandDna: JSON.stringify(dna), brandVibe: brand.tone },
      });
    })().catch(() => {});

    sendSuccess(res, brand, 201);
  } catch (err) {
    next(err);
  }
}

export async function getBrand(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const brand = await prisma.brand.findUnique({ where: { userId: req.user!.id } });

    if (!brand) {
      return next(createError("Brand not found", 404));
    }

    sendSuccess(res, brand);
  } catch (err) {
    next(err);
  }
}

export async function deleteBrand(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const existing = await prisma.brand.findUnique({ where: { userId } });
    if (!existing) {
      return next(createError("Brand not found", 404));
    }
    // Content, images, posts, videos and calendar entries are removed with it (onDelete: Cascade).
    await prisma.brand.delete({ where: { userId } });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function updateBrand(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const existing = await prisma.brand.findUnique({ where: { userId } });
    if (!existing) {
      return next(createError("Brand not found", 404));
    }

    const { brandName, industry, targetAudience, tone, platforms, brandBrief, logoUrl } = req.body as BrandInput;

    const brand = await prisma.brand.update({
      where: { userId },
      data: {
        brandName,
        industry,
        targetAudience,
        tone,
        platforms: platforms ?? [],
        brandBrief: brandBrief ?? null,
        logoUrl: logoUrl !== undefined ? logoUrl : existing.logoUrl,
      },
    });

    sendSuccess(res, brand);
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/brand/logo ────────────────────────────────────────────────────
// Update or remove the brand logo. Accepts { logoUrl: string | null }.

export async function updateLogoUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const existing = await prisma.brand.findUnique({ where: { userId } });
    if (!existing) {
      return next(createError("Brand not found", 404));
    }

    const { logoUrl } = req.body as LogoUrlInput;

    const brand = await prisma.brand.update({
      where: { userId },
      data: { logoUrl },
    });

    sendSuccess(res, brand);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/brand/regenerate-voice ────────────────────────────────────────
// Regenerates the brand voice summary from the current brand profile.

export async function regenerateVoiceSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await prisma.brand.findUnique({ where: { userId: req.user!.id } });
    if (!existing) return next(createError("Brand not found", 404));

    const summary = await generateVoiceSummaryText(existing);
    const updated = await prisma.brand.update({
      where: { userId: req.user!.id },
      data: { voiceSummary: summary.trim() },
    });

    sendSuccess(res, { voiceSummary: updated.voiceSummary });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/brand/refresh-dna ─────────────────────────────────────────────
// Regenerates the Brand DNA profile from the current brand profile.

export async function refreshBrandDNA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await prisma.brand.findUnique({ where: { userId: req.user!.id } });
    if (!existing) return next(createError("Brand not found", 404));

    const dna = await generateBrandDNA({
      brandName: existing.brandName,
      whatTheySell: existing.whatTheySell,
      brandBrief: existing.brandBrief,
      industry: existing.industry,
      brandVibe: existing.brandVibe || existing.tone,
    });

    const updated = await prisma.brand.update({
      where: { userId: req.user!.id },
      data: { brandDna: JSON.stringify(dna) },
    });

    sendSuccess(res, { brandDna: JSON.parse(updated.brandDna as string) });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/brand/extract-color ───────────────────────────────────────────
// Extracts the dominant + secondary color from the current brand's logo and
// saves them to the brand record. Call automatically after a logo upload.

export async function extractBrandColor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const colors = await extractBrandColorFromLogo(req.user!.id);
    sendSuccess(res, colors);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/brand/generate-field ──────────────────────────────────────────
// AI-generates a target audience description or brand brief from brand context.
// Called during onboarding before the brand record exists.

export async function generateBrandField(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { brandName, industry, tone, platforms, field, draft } = req.body as GenerateFieldInput;
    const platformsStr = platforms.length > 0 ? platforms.join(", ") : "various channels";

    const system =
      "You are a brand strategy expert. Return only the requested text — no labels, no bullet points, no preamble, no trailing explanation.";

    const maxChars = field === "targetAudience" ? 380 : 480;
    const draftText = draft?.trim() ?? "";

    const user = draftText
      ? `${brandName} is a ${industry} brand with a ${tone} tone that sells on ${platformsStr}. The owner wrote this ${
          field === "targetAudience" ? "description of their target audience" : "brand brief"
        }:\n\n"${draftText}"\n\nRefine it into a broader, clearer explanation that helps an AI marketing tool understand this brand's needs. Keep every fact the owner gave and do not contradict them. Add the useful context that is clearly implied (who it is for, what they care about, how they shop or what the brand offers, why it matters), but do not invent specific numbers, names or claims. Write one flowing paragraph in plain language and stay under ${maxChars} characters.`
      : field === "targetAudience"

        ? `${brandName} is a ${industry} brand with a ${tone} tone that sells on ${platformsStr}. Write a detailed target audience profile in 3-4 sentences covering demographics, psychographics, shopping behaviour, and key pain points. Write it as a flowing paragraph.`
        : `Write a 5-sentence brand brief for ${brandName}, a ${industry} brand with a ${tone} tone that sells on ${platformsStr}. Cover: what the brand does, who it serves, its unique value proposition, its core values, and its market position. Write in third person as a professional brand description.`;

    const text = (await generateText(system, user)) as string;
    sendSuccess(res, { text: text.trim().slice(0, maxChars + 20) });
  } catch (err) {
    next(err);
  }
}
