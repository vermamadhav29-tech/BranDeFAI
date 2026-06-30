import prisma from "../utils/prisma";
import { generateText } from "./ai/openaiService";
import { buildBrandSystemPrompt } from "../utils/promptBuilder";
import { createError } from "../middleware/errorHandler";
import type { Brand } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContentPillar {
  name: string;
  description: string;
  examples: string[];
}

export interface SceneBreakdown {
  sceneNumber: number;
  visualDescription: string;
  productInvolved: string;
  aiVideoPrompt: string;
  duration: 5;
  generatedImageUrl?: string;
  generatedClipUrl?: string;
}

export interface VideoIdea {
  videoTitle: string;
  concept: string;
  estimatedDuration: "5s" | "10s" | "15s" | "30s+";
  numberOfScenes: number;
  scenes: SceneBreakdown[];
  suggestedAudioType: string;
}

export interface PostIdea {
  title: string;
  caption: string;
  contentPillar: string;
  format: "image" | "carousel" | "reel";
  hook: string;
  cta: string;
}

export interface StrategyData {
  contentPillars: ContentPillar[];
  hookFrameworks: string[];
  postingRhythm: string;
  monthDirectionSummary: string;
  contentMix: {
    educational: number;
    entertaining: number;
    promotional: number;
  };
  postIdeas: PostIdea[];
  videoIdeas: VideoIdea[];
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

// Call 1 — brand fundamentals (no scenes, no long text blocks)
const FOUNDATIONS_PROMPT = `Return ONLY a JSON object with exactly this shape — no markdown, no extra keys:
{
  "contentPillars": [
    { "name": "string", "description": "string (1 sentence)", "examples": ["string","string","string"] },
    { "name": "string", "description": "string (1 sentence)", "examples": ["string","string","string"] },
    { "name": "string", "description": "string (1 sentence)", "examples": ["string","string","string"] },
    { "name": "string", "description": "string (1 sentence)", "examples": ["string","string","string"] }
  ],
  "hookFrameworks": ["string","string","string","string","string","string"],
  "postingRhythm": "string (1 line, e.g. '5x per week: 3 feed posts, 2 reels')",
  "monthDirectionSummary": "string (2-3 sentences)",
  "contentMix": { "educational": number, "entertaining": number, "promotional": number }
}
Rules: contentPillars = exactly 4 objects each with exactly 3 examples. hookFrameworks = exactly 6 attention-grabbing opening lines. contentMix = three integers summing to 100.`;

// Call 2 — post ideas (captions + format guidance)
const POST_IDEAS_PROMPT = `Return ONLY a JSON object with exactly this shape — no markdown, no extra keys:
{
  "postIdeas": [
    {
      "title": "string (max 5 words)",
      "caption": "string (max 100 words, ends with 5 lowercase hashtags)",
      "contentPillar": "string (name of one of the brand's content pillars)",
      "format": "image" | "carousel" | "reel",
      "hook": "string (scroll-stopping opening line, max 10 words)",
      "cta": "string (one of: Shop Now / Explore / DM to Order / Grab Yours / Learn More)"
    }
  ]
}
Rules: postIdeas = exactly 5 objects. Mix the formats (at least one of each: image, carousel, reel). Each caption must be unique and brand-appropriate. Return ONLY the JSON.`;

// Call 3 — video ideas with scene breakdowns (5 max, kept concise per scene)
const VIDEO_IDEAS_PROMPT = `Return ONLY a JSON object with exactly this shape — no markdown, no extra keys:
{
  "videoIdeas": [
    {
      "videoTitle": "string (max 8 words)",
      "concept": "string (1 sentence)",
      "estimatedDuration": "5s" | "10s" | "15s" | "30s+",
      "numberOfScenes": number,
      "scenes": [
        {
          "sceneNumber": number,
          "visualDescription": "string (1 sentence — what the camera sees: subject, composition, background)",
          "productInvolved": "string (specific product shot type, e.g. 'hero product flat lay')",
          "aiVideoPrompt": "string (1-2 sentences — cinematic RunwayML prompt with camera movement, lighting, motion)",
          "duration": 5
        }
      ],
      "suggestedAudioType": "string (one of: Trending beat / Lo-fi ambient / Upbeat pop / Cinematic orchestral / Voiceover / Silent with text / Nature sounds)"
    }
  ]
}
Rules:
- videoIdeas = exactly 5 objects, diverse mix of durations
- estimatedDuration rule: "5s" → numberOfScenes=1, exactly 1 scene; "10s" → 1-2 scenes; "15s" → 3 scenes; "30s+" → 4 scenes max
- duration field on every scene is always the integer 5
- Keep aiVideoPrompt to 1-2 sentences — be specific about camera movement and motion
- Return ONLY the JSON.`;

// ─── generateStrategy — 3 parallel calls ─────────────────────────────────────

export async function generateStrategy(userId: string): Promise<StrategyData> {
  const brand = await prisma.brand.findUnique({ where: { userId } });
  if (!brand) throw createError("Brand not found", 404);

  const systemPrompt = buildBrandSystemPrompt(brand);

  // Run all 3 calls in parallel — each has its own max_tokens: 2000 budget
  const [foundationsRaw, postIdeasRaw, videoIdeasRaw] = await Promise.all([
    generateText(systemPrompt, FOUNDATIONS_PROMPT, true, 2000),
    generateText(systemPrompt, POST_IDEAS_PROMPT, true, 2000),
    generateText(systemPrompt, VIDEO_IDEAS_PROMPT, true, 2000),
  ]);

  const foundations = foundationsRaw as {
    contentPillars: ContentPillar[];
    hookFrameworks: string[];
    postingRhythm: string;
    monthDirectionSummary: string;
    contentMix: { educational: number; entertaining: number; promotional: number };
  };

  const postSection = postIdeasRaw as { postIdeas: PostIdea[] };
  const videoSection = videoIdeasRaw as { videoIdeas: VideoIdea[] };

  return {
    contentPillars: foundations.contentPillars ?? [],
    hookFrameworks: foundations.hookFrameworks ?? [],
    postingRhythm: foundations.postingRhythm ?? "",
    monthDirectionSummary: foundations.monthDirectionSummary ?? "",
    contentMix: foundations.contentMix ?? { educational: 40, entertaining: 40, promotional: 20 },
    postIdeas: postSection.postIdeas ?? [],
    videoIdeas: videoSection.videoIdeas ?? [],
  };
}

// ─── approveStrategy ──────────────────────────────────────────────────────────

export async function approveStrategy(
  userId: string,
  strategyData: StrategyData
): Promise<Brand> {
  const brand = await prisma.brand.findUnique({ where: { userId } });
  if (!brand) throw createError("Brand not found", 404);

  const updated = await prisma.brand.update({
    where: { userId },
    data: {
      strategyApproved: true,
      strategyData: strategyData as object,
    },
  });

  return updated;
}
