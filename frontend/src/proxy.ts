import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// /brand-setup is intentionally excluded: the OAuth exchange sets the auth cookie
// on the backend domain, so it isn't available to this middleware during the RSC
// fetch that immediately follows router.replace('/brand-setup'). The page-level
// guard in brand-setup/page.tsx handles auth after the Zustand store settles.
const protectedRoutes = [
  "/dashboard",
  "/strategy",
  "/calendar",
  "/images",
  "/videos",
  "/instagram",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const isLogin = pathname === "/login";
  const hasToken = request.cookies.has("brandefai_token");

  if (isProtected && !hasToken) {
    console.log("[proxy] redirecting to /login — no token cookie for protected route:", pathname);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isLogin && hasToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
