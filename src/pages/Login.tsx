// pages/Login.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { auth } from "@/config/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isNativePlatform } from "@/lib/capacitor";

type AuthMode = "choose" | "email" | "phone" | "otp";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isSignedIn, isAuthLoading, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useAuth();
  const [mode, setMode] = useState<AuthMode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  // Redirect if already signed in (non-anonymous)
  useEffect(() => {
    if (isSignedIn) navigate("/chat", { replace: true });
  }, [isSignedIn, navigate]);

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-zinc-900 dark:to-zinc-800">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isSignedIn) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("Invalid email or password.");
      } else if (msg.includes("email-already-in-use")) {
        setError("An account with this email already exists. Try signing in.");
      } else if (msg.includes("weak-password")) {
        setError("Password must be at least 6 characters.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault?.();
    setError(null);
    setLoading(true);
    try {
      // Format phone number
      let formatted = phone.trim();
      if (!formatted.startsWith("+")) {
        formatted = "+91" + formatted; // Default to India
      }

      // Always rebuild the reCAPTCHA: phone-auth tokens are single-use, so
      // both error-retry and "Resend code" must start fresh. Reusing a
      // consumed verifier was the silent-fail cause of resend on mobile.
      if (recaptchaVerifier.current) {
        try { recaptchaVerifier.current.clear(); } catch { /* widget may already be torn down */ }
        recaptchaVerifier.current = null;
      }
      if (!recaptchaRef.current) {
        throw new Error("reCAPTCHA container not mounted");
      }
      recaptchaVerifier.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
        size: "invisible",
      });

      const result = await signInWithPhoneNumber(auth, formatted, recaptchaVerifier.current);
      setConfirmationResult(result);
      setMode("otp");
      // Focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.includes("invalid-phone-number")) {
        setError("Invalid phone number. Include country code (e.g. +919008425920).");
      } else if (msg.includes("too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(msg);
      }
      // Reset reCAPTCHA on error so the next attempt rebuilds it.
      if (recaptchaVerifier.current) {
        try { recaptchaVerifier.current.clear(); } catch { /* noop */ }
        recaptchaVerifier.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      await confirmationResult!.confirm(code);
    } catch {
      setError("Invalid verification code. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Strip non-digits — SMS autofill on iOS sometimes injects spaces/dashes.
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      // Pure clear (backspace produced empty value).
      const cleared = [...otp];
      cleared[index] = "";
      setOtp(cleared);
      return;
    }

    const newOtp = [...otp];
    if (digits.length === 1) {
      // Single keypress.
      newOtp[index] = digits;
      if (index < 5) otpRefs.current[index + 1]?.focus();
    } else {
      // Multi-digit input — SMS autofill or paste of the full code. Distribute
      // across the inputs starting at the current index. iOS "From Messages"
      // chip pastes the entire 6-digit code into the focused input; without
      // this, only the first digit is kept and OTP looks "broken" on mobile.
      for (let i = 0; i < digits.length && index + i < 6; i++) {
        newOtp[index + i] = digits[i];
      }
      const lastFilled = Math.min(index + digits.length, 5);
      otpRefs.current[lastFilled]?.focus();
    }
    setOtp(newOtp);

    // Auto-submit when all 6 digits entered.
    if (newOtp.every((d) => d) && newOtp.join("").length === 6) {
      setTimeout(() => handleVerifyOtp(), 150);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
        backgroundSize: "40px 40px",
      }} />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-zinc-700/50 shadow-2xl shadow-black/5 dark:shadow-black/30 p-8">

          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl font-bold mb-4 shadow-lg shadow-blue-500/25">
              YF
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              YourFinAdvisor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered financial guidance
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-6">
              {error}
            </div>
          )}

          {/* Main chooser */}
          {mode === "choose" && (
            <div className="space-y-3">
              {/* Google — not available in native WebView (no popup support) */}
              {!isNativePlatform && (
                <Button
                  variant="outline"
                  className="w-full h-12 gap-3 text-sm font-medium rounded-xl border-border/50 hover:bg-accent/50 transition-all"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </Button>
              )}

              {/* Phone — not available in native WebView (no reCAPTCHA support) */}
              {!isNativePlatform && (
                <Button
                  variant="outline"
                  className="w-full h-12 gap-3 text-sm font-medium rounded-xl border-border/50 hover:bg-accent/50 transition-all"
                  onClick={() => { setMode("phone"); setError(null); }}
                  disabled={loading}
                >
                  <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  Continue with Phone
                </Button>
              )}

              {/* Email */}
              <Button
                variant="outline"
                className="w-full h-12 gap-3 text-sm font-medium rounded-xl border-border/50 hover:bg-accent/50 transition-all"
                onClick={() => { setMode("email"); setError(null); }}
                disabled={loading}
              >
                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                Continue with Email
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white/80 dark:bg-zinc-900/80 px-3 text-xs text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigate("/chat")}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Continue without signing in
              </button>
            </div>
          )}

          {/* Email form */}
          {mode === "email" && (
            <div className="space-y-4">
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl bg-background/50"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 rounded-xl bg-background/50"
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl font-medium" disabled={loading}>
                  {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                  className="text-primary font-medium hover:underline"
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </button>
              </p>

              <button
                onClick={() => { setMode("choose"); setError(null); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to all options
              </button>
            </div>
          )}

          {/* Phone form */}
          {mode === "phone" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                We'll send a verification code to your phone
              </p>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex items-center justify-center h-12 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm text-muted-foreground shrink-0">
                    +91
                  </div>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
                    required
                    className="h-12 rounded-xl bg-background/50"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl font-medium" disabled={loading}>
                  {loading ? "Sending..." : "Send Verification Code"}
                </Button>
              </form>

              <button
                onClick={() => { setMode("choose"); setError(null); setPhone(""); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to all options
              </button>
            </div>
          )}

          {/* OTP verification */}
          {mode === "otp" && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground text-center">
                Enter the 6-digit code sent to{" "}
                <span className="font-medium text-foreground">
                  {phone.startsWith("+") ? phone : "+91" + phone}
                </span>
              </p>

              <div className="flex justify-center gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    // Only the first input declares one-time-code so the iOS
                    // SMS autofill chip targets it; handleOtpChange distributes
                    // the full pasted code across the remaining inputs.
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    // No maxLength — we need to receive the full pasted/autofilled
                    // string so handleOtpChange can fan it out to the other boxes.
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-13 text-center text-lg font-semibold rounded-xl border border-border/50 bg-background/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                ))}
              </div>

              <Button
                className="w-full h-12 rounded-xl font-medium"
                onClick={handleVerifyOtp}
                disabled={loading || otp.join("").length !== 6}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </Button>

              <div className="flex justify-between">
                <button
                  onClick={() => { setMode("phone"); setOtp(["", "", "", "", "", ""]); setError(null); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Change number
                </button>
                <button
                  onClick={handleSendOtp}
                  className="text-sm text-primary hover:underline font-medium"
                  disabled={loading}
                >
                  Resend code
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          By continuing, you agree to our Terms of Service
        </p>
      </div>

      {/* Invisible reCAPTCHA container */}
      <div ref={recaptchaRef} id="recaptcha-container" />
    </div>
  );
}
