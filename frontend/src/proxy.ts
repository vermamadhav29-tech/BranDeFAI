import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth-based route protection is intentionally absent here.
// brandefai_token is set on the Railway backend domain; this middleware runs on the
// Vercel frontend domain and can never see that cookie. Redirecting based on its
// absence would block every authenticated user on every page load.
// All auth gating is handled client-side: DashboardShell for all /(dashboard) routes,
// and the page-level guard in brand-setup/page.tsx for the onboarding flow.
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
