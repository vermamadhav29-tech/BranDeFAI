export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export type ContentType = "caption" | "image" | "video" | "reel" | "ad_copy";
export type PostStatus = "draft" | "scheduled" | "posted" | "failed";
export type PlanType = "starter" | "growth" | "pro";
