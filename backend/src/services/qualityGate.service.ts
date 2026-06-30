import * as openaiService from "./ai/openaiService";

// ─── Silent AI quality gate ────────────────────────────────────────────────────
// Reviews generated content before it reaches the user. Scores and any
// rewriting are entirely internal — never surfaced in any API response or UI.

const QUALITY_GATE_SYSTEM_PROMPT = `You are a brutal content quality reviewer for Indian small business brands.
Score this Instagram caption on 4 dimensions (1-10 each):
1. brand_voice_match: Does it sound exactly like the brand described?
2. hook_quality: Would an Indian user stop scrolling at the first line?
3. promotional_strength: Does it make the reader want to buy/visit/DM?
4. authenticity: Does it sound like a real human wrote it (not AI)?
If ANY score is below 7, rewrite the caption to score 8+ on all dimensions.
Keep the brand voice exactly the same. Make it better, not different.
Return ONLY valid JSON:
{
overall_score: number,
scores: { brand_voice_match: number, hook_quality: number, promotional_strength: number,
authenticity: number },
needs_improvement: boolean,
improved_version: string or null
}`;

export interface QualityScores {
  brand_voice_match: number;
  hook_quality: number;
  promotional_strength: number;
  authenticity: number;
}

export interface QualityReview {
  overall_score: number;
  scores: QualityScores;
  needs_improvement: boolean;
  improved_version: string | null;
}

export async function reviewContent(content: string, brandContext: string): Promise<QualityReview> {
  const userPrompt = [brandContext, ``, `CAPTION TO REVIEW:`, content].join("\n");

  return (await openaiService.generateText(
    QUALITY_GATE_SYSTEM_PROMPT,
    userPrompt,
    true,
    1000
  )) as QualityReview;
}
