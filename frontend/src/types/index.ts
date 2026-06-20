export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface User {
  id: string;
  email: string;
  plan: string;
  creditsBalance: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Brand {
  id: string;
  userId: string;
  brandName: string;
  industry: string;
  tone: string;
  targetAudience: string;
  logoUrl: string | null;
  platforms: string[];
  brandBrief: string | null;
  voiceSummary?: string | null;
  strategyApproved: boolean;
  strategyData?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentPost {
  id: string;
  brandId: string;
  type: "caption" | "image" | "video" | "reel" | "ad_copy";
  content: string;
  mediaUrl?: string;
  status: "draft" | "scheduled" | "posted" | "failed";
  scheduledAt?: string;
  postedAt?: string;
}

export interface CalendarSlot {
  date: string;
  posts: ContentPost[];
}
