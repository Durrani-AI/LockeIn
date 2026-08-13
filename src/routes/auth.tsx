import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { LockedInLogo } from "@/components/lockedin-logo";
import { toast } from "sonner";

type AuthLikeError = {
  message?: string;
  code?: string;
  status?: number;
};

const POST_AUTH_REDIRECT_KEY = "lockedin_post_auth_redirect";

function consumePostAuthRedirect(): string {
  if (typeof window === "undefined") {
    return "/app";
  }

  const stored = window.sessionStorage.getItem(POST_AUTH_REDIRECT_KEY);
  window.sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);

  return stored && stored.startsWith("/app") ? stored : "/app";
}

function getAuthErrorMessage(error: unknown, mode: "signin" | "signup") {
  const authError = error as AuthLikeError | undefined;
  const code = authError?.code;

  if (code === "invalid_credentials") {
    return "Those credentials are not recognized for this account in the current project. If you originally used Google, continue with Google.";
  }

  if (code === "email_not_confirmed") {
    return "Your email is not confirmed yet. Please verify your email and try again.";
  }

  if (code === "over_email_send_rate_limit") {
    return "Email rate limit reached. Please wait before requesting another email.";
  }

  if (code === "over_request_rate_limit") {
    return "Too many attempts in a short time. Please wait a minute and try again.";
  }

  if (mode === "signup" && (code === "email_exists" || code === "user_already_exists")) {
    return "An account with this email already exists. Switch to Sign in.";
  }

  if (typeof authError?.message === "string" && authError.message.trim().length > 0) {
    return authError.message;
  }

  return "Something went wrong";
}

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resetEmailSentTo, setResetEmailSentTo] = useState<string | null>(null);
  const [verifiedFromLink, setVerifiedFromLink] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!loading && user && !recoveryMode && typeof window !== "undefined") {
      window.location.replace(consumePostAuthRedirect());
    }
  }, [user, loading, recoveryMode]);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const verified = url.searchParams.get("verified") === "1";
    const recovery = url.searchParams.get("mode") === "recovery"
      || /(?:^|[&#])type=recovery(?:&|$)/.test(window.location.hash);

    if (!verified && !recovery) return;

    if (verified) {
      setVerifiedFromLink(true);
      setActiveTab("signin");
      url.searchParams.delete("verified");
    }
    if (recovery) {
      setRecoveryMode(true);
      setActiveTab("signin");
      url.searchParams.delete("mode");
    }

    const cleanedQuery = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${cleanedQuery ? `?${cleanedQuery}` : ""}${url.hash}`);
  }, []);

  const requestPasswordReset = async (email: string) => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      throw new Error("Enter your email first, then try password reset again.");
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/auth?mode=recovery`,
    });
    if (error) throw error;

    setResetEmailSentTo(normalizedEmail);
    setPendingVerificationEmail(null);
    setVerifiedFromLink(false);
  };

  const finishRecovery = () => {
    setRecoveryMode(false);
    if (typeof window !== "undefined") {
      window.location.replace(consumePostAuthRedirect());
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 bg-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" />
      <div className="absolute inset-0 bg-radial-fade" />

      <div className="relative w-full max-w-md">
        <Link to="/" className="group mb-8 flex items-center justify-center gap-2.5 font-display text-lg font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong bg-surface transition-colors group-hover:border-primary/60">
            <LockedInLogo className="h-7 w-7" animated />
          </span>
          LockedIn
        </Link>

        <div className="rounded-2xl border border-border-strong bg-card p-8 shadow-soft">
          {pendingVerificationEmail ? (
            <div className="mb-4 rounded-md border border-primary/30 bg-primary-soft/60 px-3 py-2 text-sm text-foreground">
              Verification email sent to <span className="font-medium">{pendingVerificationEmail}</span>. Confirm your email, then sign in.
            </div>
          ) : null}

          {resetEmailSentTo && !recoveryMode ? (
            <div className="mb-4 rounded-md border border-primary/30 bg-primary-soft/60 px-3 py-2 text-sm text-foreground">
              Password reset email sent to <span className="font-medium">{resetEmailSentTo}</span>. Open the link in that email to choose a new password.
            </div>
          ) : null}

          {verifiedFromLink ? (
            <div className="mb-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-foreground">
              Email verified successfully. You can sign in now.
            </div>
          ) : null}

          {recoveryMode ? (
            <ResetPasswordForm
              onBackToSignIn={() => setRecoveryMode(false)}
              onComplete={finishRecovery}
            />
          ) : (
            <>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "signin" | "signup")} className="w-full">
                <TabsList className="mb-6 grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <AuthForm mode="signin" onForgotPassword={requestPasswordReset} />
                </TabsContent>
                <TabsContent value="signup">
                  <AuthForm
                    mode="signup"
                    onPendingVerification={(email) => {
                      setPendingVerificationEmail(email);
                      setResetEmailSentTo(null);
                      setVerifiedFromLink(false);
                      setActiveTab("signin");
                    }}
                  />
                </TabsContent>
              </Tabs>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <GoogleButton />
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our terms.
        </p>
      </div>
    </div>
  );
}

function AuthForm({
  mode,
  onPendingVerification,
  onForgotPassword,
}: {
  mode: "signin" | "signup";
  onPendingVerification?: (email: string) => void;
  onForgotPassword?: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth?verified=1` },
        });
        if (error) throw error;

        if (data.session) {
          toast.success("Account created — you're in.");
        } else {
          onPendingVerification?.(email);
          toast.success("Check your inbox to verify your account before signing in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (err) {
      const msg = getAuthErrorMessage(err, mode);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {mode === "signin" && onForgotPassword ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onForgotPassword(email);
                toast.success("Reset email sent. Check your inbox.");
              } catch (err) {
                toast.error(getAuthErrorMessage(err, "signin"));
              } finally {
                setBusy(false);
              }
            }}
          >
            Forgot password?
          </button>
        </div>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}

function ResetPasswordForm({
  onBackToSignIn,
  onComplete,
}: {
  onBackToSignIn: () => void;
  onComplete: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      onComplete();
    } catch (err) {
      toast.error(getAuthErrorMessage(err, "signin"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password for your account, then we&apos;ll take you back into LockedIn.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recovery-password">New password</Label>
          <Input
            id="recovery-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recovery-confirm-password">Confirm new password</Label>
          <Input
            id="recovery-confirm-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="flex-1" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </Button>
          <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={onBackToSignIn}>
            Back to sign in
          </Button>
        </div>
      </form>
    </div>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin + "/app" },
          });
          if (error) throw error;
        } catch (err) {
          const msg = getAuthErrorMessage(err, "signin");
          toast.error(msg);
          setBusy(false);
        }
      }}
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </Button>
  );
}
