import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/brand-setup",
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
