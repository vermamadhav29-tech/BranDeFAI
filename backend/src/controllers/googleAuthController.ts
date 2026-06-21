import { Request, Response } from "express";
import axios from "axios";
import prisma from "../utils/prisma";
import { signToken } from "../utils/jwt";
import { COOKIE_NAME, COOKIE_OPTIONS } from "../utils/cookies";

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
  const frontendUrl = process.env.FRONTEND_URL!;
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

    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    // Redirect to dashboard if they have a brand, otherwise brand-setup
    const brand = await prisma.brand.findUnique({ where: { userId: user.id } });
    const destination = brand ? `${frontendUrl}/dashboard` : `${frontendUrl}/brand-setup`;
    console.log(`[Google OAuth] redirecting to ${destination}`);
    res.redirect(destination);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Google OAuth] callback error:", msg);
    res.redirect(`${frontendUrl}/login?error=google_failed`);
  }
}
