export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
  createdAt: string;
}

export interface Brand {
  id: string;
  userId: string;
  name: string;
  niche: string;
  tone: string;
  targetAudience: string;
  logoUrl?: string;
  colors: string[];
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
