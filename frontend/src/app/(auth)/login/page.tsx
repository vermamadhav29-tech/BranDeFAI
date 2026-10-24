"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Brand from "@/components/draftr/Brand";
import apiClient from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

// ─── Schemas ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

// ─── Left side — brand panel ───────────────────────────────────────────────────

function BrandPanel() {
  return (
    <aside className="bd-auth-brand">
      <div className="bd-auth-logo">
        <a href="/" aria-label="BrandefAI home" style={{ display: "block", height: "100%" }}>
          <Brand tone="light" size={26} />
        </a>
      </div>

      <div className="bd-auth-copy bd-reveal">
        <h1>
          Your brand.
          <br />
          <span>Fully automated.</span>
        </h1>
        <p>Captions, images and reels — planned and created on autopilot.</p>
      </div>

      <ol className="bd-auth-steps">
        <li><b>1</b><span><strong>Set up your brand</strong>Logo, tone and products, once.</span></li>
        <li><b>2</b><span><strong>Generate content</strong>Captions, images and reels in your voice.</span></li>
        <li><b>3</b><span><strong>Auto-fill your calendar</strong>30 days planned, ready to approve.</span></li>
      </ol>
    </aside>
  );
}

// ─── Google button ─────────────────────────────────────────────────────────────

function GoogleButton() {
  function handleGoogleLogin() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const target = `${apiUrl}/api/auth/google`;
    if (!apiUrl) {
      console.error("[GoogleButton] NEXT_PUBLIC_API_URL is not defined — check Vercel env vars");
      return;
    }
    window.location.href = target;
  }

  return (
    <button type="button" className="bd-btn bd-btn-dark" onClick={handleGoogleLogin}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
        <path fill="#FBBC05" d="M3.964 10.71C3.786 10.17 3.682 9.593 3.682 9s.104-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
      </svg>
      Continue with Google
    </button>
  );
}

function OrDivider() {
  return <div className="bd-or">OR</div>;
}

function Field({
  id, label, type = "text", error, autoComplete, ...rest
}: { id: string; label: string; type?: string; error?: string; autoComplete?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="bd-field">
      <label className="bd-label" htmlFor={id}>{label}</label>
      <input id={id} type={type} autoComplete={autoComplete} className={"bd-input" + (error ? " has-error" : "")} {...rest} />
      {error ? <p className="bd-field-err">{error}</p> : null}
    </div>
  );
}

// ─── Sign In Form ──────────────────────────────────────────────────────────────

function SignInForm({ onShake }: { onShake: () => void }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (data) => {
    setApiError(null);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { userId: string; email: string; plan: string; creditsBalance: number; isOnboarded: boolean };
        error: string | null;
      }>("/api/auth/login", data);
      if (res.data.success) {
        const { userId, email, plan, creditsBalance, isOnboarded } = res.data.data;
        setUser({ id: userId, email, plan, creditsBalance });
        router.push(isOnboarded ? "/dashboard" : "/brand-setup");
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Sign in failed. Please try again.";
      setApiError(message);
      onShake();
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field id="login-email" label="Email address" type="email" autoComplete="email" placeholder="you@brand.com" error={errors.email?.message} {...register("email")} />
      <Field id="login-password" label="Password" type="password" autoComplete="current-password" placeholder="••••••••" error={errors.password?.message} {...register("password")} />

      {apiError && <p className="bd-error" role="alert" style={{ marginTop: 0, marginBottom: 16 }}>{apiError}</p>}

      <button type="submit" disabled={isSubmitting} className="bd-btn bd-btn-primary">
        {isSubmitting ? (<><Loader2 size={17} className="bd-spin-icon" /> Signing in…</>) : "Sign in"}
      </button>

      <OrDivider />
      <GoogleButton />
    </form>
  );
}

// ─── Register Form ─────────────────────────────────────────────────────────────

function RegisterForm({ onShake }: { onShake: () => void }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (data) => {
    setApiError(null);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { userId: string; email: string; plan: string; creditsBalance?: number };
        error: string | null;
      }>("/api/auth/register", { email: data.email, password: data.password });
      if (res.data.success) {
        const { userId, email, plan, creditsBalance } = res.data.data;
        setUser({ id: userId, email, plan, creditsBalance: creditsBalance ?? 50 });
        router.push("/brand-setup");
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Registration failed. Please try again.";
      setApiError(message);
      onShake();
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field id="reg-email" label="Email address" type="email" autoComplete="email" placeholder="you@brand.com" error={errors.email?.message} {...register("email")} />
      <Field id="reg-password" label="Password (min. 8 characters)" type="password" autoComplete="new-password" placeholder="••••••••" error={errors.password?.message} {...register("password")} />
      <Field id="reg-confirm" label="Confirm password" type="password" autoComplete="new-password" placeholder="••••••••" error={errors.confirmPassword?.message} {...register("confirmPassword")} />

      {apiError && <p className="bd-error" role="alert" style={{ marginTop: 0, marginBottom: 16 }}>{apiError}</p>}

      <button type="submit" disabled={isSubmitting} className="bd-btn bd-btn-primary">
        {isSubmitting ? (<><Loader2 size={17} className="bd-spin-icon" /> Creating account…</>) : "Create account"}
      </button>

      <OrDivider />
      <GoogleButton />
    </form>
  );
}

// ─── Right side — form panel ───────────────────────────────────────────────────

type Tab = "signin" | "register";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_failed: "Google sign-in failed. Please try again.",
};

function OAuthErrorBanner() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  if (!oauthError || !GOOGLE_ERROR_MESSAGES[oauthError]) return null;
  return <p className="bd-error" role="alert" style={{ marginTop: 0, marginBottom: 16 }}>{GOOGLE_ERROR_MESSAGES[oauthError]}</p>;
}

function FormPanel() {
  const [tab, setTab] = useState<Tab>("signin");
  const [shakeKey, setShakeKey] = useState(0);
  const triggerShake = () => setShakeKey((k) => k + 1);

  return (
    <main className="bd-auth-form">
      <div className="bd-auth-box bd-reveal">
        <div className="bd-auth-mlogo">
          <a href="/" aria-label="BrandefAI home" style={{ display: "block", height: "100%" }}>
            <Brand size={24} />
          </a>
        </div>

        <h2>{tab === "signin" ? "Welcome back" : "Create your account"}</h2>
        <p className="bd-auth-sub">
          {tab === "signin" ? "Sign in to your BrandefAI account." : "Start with a free 3-day trial. No card needed."}
        </p>

        <Suspense fallback={null}>
          <OAuthErrorBanner />
        </Suspense>

        <div className="bd-seg" role="tablist">
          {(["signin", "register"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "is-on" : ""} onClick={() => setTab(t)}>
              {t === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <div key={shakeKey} className={"bd-auth-pane" + (shakeKey ? " bd-shake" : "")}>
          {tab === "signin" ? <SignInForm onShake={triggerShake} /> : <RegisterForm onShake={triggerShake} />}
        </div>

        <p className="bd-auth-foot">
          By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div className="bd-auth">
      <BrandPanel />
      <FormPanel />
    </div>
  );
}
