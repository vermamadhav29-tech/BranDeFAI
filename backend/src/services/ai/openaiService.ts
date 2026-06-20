import OpenAI from "openai";
import { createError } from "../../middleware/errorHandler";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Retry wrapper — retries once after 3 s on 429 ────────────────────────────

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 429) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        return await fn();
      } catch (retryErr: unknown) {
        const re = retryErr as { message?: string };
        throw createError(re.message ?? "OpenAI request failed after retry", 502);
      }
    }
    throw createError(e.message ?? "OpenAI request failed", 502);
  }
}

// ─── safeParseJSON — handles truncated or wrapped responses ──────────────────

export function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch (e) {
    const match = str.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through to original error
      }
    }
    throw new Error(`JSON parse failed: ${(e as Error).message}`);
  }
}

// ─── generateText ─────────────────────────────────────────────────────────────

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false,
  maxTokens = 2000
): Promise<unknown> {
  const completion = await withRetry(() =>
    openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: maxTokens,
      response_format: { type: jsonMode ? "json_object" : "text" } as { type: "json_object" | "text" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })
  );

  const content = completion.choices[0]?.message?.content ?? "";
  return jsonMode ? safeParseJSON(content) : content;
}

// ─── generatePostBrief ───────────────────────────────────────────────────────

export interface PostBriefData {
  postTitle: string;
  postConcept: string;
  visualBrief: string;
  textOverlay: string;
  ctaText: string;
  caption: string;
}

export async function generatePostBrief(
  imageUrl: string,
  brand: {
    brandName: string;
    industry: string;
    tone: string;
    targetAudience: string;
    voiceSummary?: string | null;
  }
): Promise<PostBriefData> {
  const systemLines = [
    `You are a social media content strategist for premium Indian ${brand.industry} brands.`,
    `Write in a ${brand.tone} tone for ${brand.targetAudience}.`,
    `Return ONLY a valid JSON object — no markdown, no code fences, no extra keys.`,
  ];
  if (brand.voiceSummary) systemLines.push(`Brand voice: ${brand.voiceSummary}`);

  const userText = [
    `Analyze this product image for ${brand.brandName} and return a complete Instagram post brief.`,
    `Return exactly this JSON shape:`,
    `{ "postTitle": "...", "postConcept": "...", "visualBrief": "...", "textOverlay": "...", "ctaText": "...", "caption": "..." }`,
    `postTitle: max 5 words capturing the post angle.`,
    `postConcept: 1-2 sentences on what this post communicates and why it resonates with the audience.`,
    `visualBrief: art direction — background color/texture, lighting style, composition, mood — written as direction for a photographer/designer.`,
    `textOverlay: scroll-stopping headline for image overlay, max 6 words.`,
    `ctaText: exactly one of: Shop Now / Explore / DM to Order / Grab Yours / Learn More.`,
    `caption: ready-to-post Instagram caption for ${brand.brandName}, max 120 words, natural brand mention, ends with exactly 5 lowercase hashtags.`,
  ].join("\n");

  const completion = await withRetry(() =>
    openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1200,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system", content: systemLines.join("\n") },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            { type: "text", text: userText },
          ],
        },
      ],
    })
  );

  const content = completion.choices[0]?.message?.content ?? "{}";
  return safeParseJSON(content) as PostBriefData;
}

// ─── analyzeImage ─────────────────────────────────────────────────────────────

export interface VisionAnalysis {
  productName: string;
  physicalDescription: string;
  colorPalette: string[];
  useCase: string;
  emotionalAppeal: string;
  marketingAngle: string;
}

export async function analyzeImage(
  imageUrl: string,
  brandContext: string
): Promise<VisionAnalysis> {
  const completion = await withRetry(() =>
    openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system", content: "You are a product marketing analyst." },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
            {
              type: "text",
              text: [
                "Analyze this product image and return ONLY a JSON object:",
                "{ productName: string, physicalDescription: string,",
                "  colorPalette: string[], useCase: string,",
                "  emotionalAppeal: string, marketingAngle: string }",
                ...(brandContext ? [`\nBrand context: ${brandContext}`] : []),
              ].join("\n"),
            },
          ],
        },
      ],
    })
  );

  const content = completion.choices[0]?.message?.content ?? "{}";
  return safeParseJSON(content) as VisionAnalysis;
}
