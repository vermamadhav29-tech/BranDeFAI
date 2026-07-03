import { Request, Response } from "express";
import axios from "axios";
import prisma from "../utils/prisma";
import { signExchangeToken } from "../utils/jwt";

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  verified_email: boolean;
}

export function googleRedirect(_req: Request, res: Response): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL;

  if (!clientId || !redirectUri) {
    res.status(503).json({ success: false, error: "Google OAuth not configured", data: null });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const { code, error } = req.query as { code?: string; error?: string };

  if (error || !code) {
    console.warn("[Google OAuth] user denied or no code:", error);
    res.redirect(`${frontendUrl}/login?error=google_denied`);
    return;
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post<{ access_token: string }>(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      },
    );

    const { access_token } = tokenRes.data;

    // Fetch the user's Google profile
    const userInfoRes = await axios.get<GoogleUserInfo>(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } },
    );

    const { id: googleId, email } = userInfoRes.data;
    console.log(`[Google OAuth] login — email=${email} googleId=${googleId}`);

    // Find by googleId first, then by email (handles existing email/password accounts)
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      // Link googleId to existing account if not already linked
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
        console.log(`[Google OAuth] linked googleId to existing account id=${user.id}`);
      }
    } else {
      // Brand-new user — no password, no brand yet
      user = await prisma.user.create({
        data: { email, googleId },
      });
      console.log(`[Google OAuth] created new user id=${user.id}`);
    }

    // Do NOT set cookie here — a cookie set in a redirect response is treated as a
    // third-party cookie by Safari ITP and Chrome and gets silently dropped.
    // Instead, redirect to the frontend with a short-lived exchange token in the URL.
    // The frontend /auth/callback page POSTs the token back to /api/auth/exchange,
    // which sets the real session cookie via a direct XHR (same as email/password login).
    const exchangeToken = signExchangeToken(user.id);
    const brand = await prisma.brand.findFirst({ where: { userId: user.id } });
    const next = brand ? "dashboard" : "brand-setup";
    const destination = `${frontendUrl}/callback?token=${exchangeToken}&next=${next}`;
    console.log(`[Google OAuth] redirecting to exchange callback, next=${next}`);
    res.redirect(destination);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Google OAuth] callback error:", msg);
    res.redirect(`${frontendUrl}/login?error=google_failed`);
  }
}
