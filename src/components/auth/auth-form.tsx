"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, MailCheck } from "lucide-react";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth";

type Mode = "login" | "signup";
type Errors = { name?: string; email?: string; password?: string; form?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// One form for both "Log in" and "Sign up". Sign up adds a name field.
export function AuthForm({ mode, initialError }: { mode: Mode; initialError?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({ form: initialError });
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const isSignup = mode === "signup";

  function validate(): Errors {
    const found: Errors = {};
    if (isSignup && !name.trim()) found.name = "Enter your name";
    if (!EMAIL_PATTERN.test(email)) found.email = "Enter a valid email address";
    if (!password) found.password = "Enter your password";
    else if (isSignup && password.length < 8)
      found.password = "Use at least 8 characters";
    return found;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading("email");
    const result = isSignup
      ? await signUpWithEmail(name.trim(), email, password)
      : await signInWithEmail(email, password);
    setLoading(null);

    if (result.error) {
      setErrors({ form: result.error });
      return;
    }
    if (result.needsEmailConfirmation) {
      setConfirmationSent(true);
      return;
    }
    // refresh() makes the server see the new login cookie.
    router.replace("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setLoading("google");
    const result = await signInWithGoogle();
    // On success the browser is already on its way to Google, so keep the spinner.
    if (result.error) {
      setLoading(null);
      setErrors({ form: result.error });
    }
  }

  if (confirmationSent) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="size-7" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Confirm your email</h1>
        <p className="mt-2 text-muted-foreground">
          We sent a link to <span className="font-medium text-foreground">{email}</span>. Click it
          to finish creating your account.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  // Clear a field's error as soon as the user edits it.
  function clearError(field: keyof Errors) {
    if (errors[field] || errors.form) setErrors({ ...errors, [field]: undefined, form: undefined });
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {isSignup
          ? "Start posting everywhere in a few minutes."
          : "Log in to keep your posts flowing."}
      </p>

      <div className="mt-8">
        <GoogleButton
          label={isSignup ? "Sign up with Google" : "Continue with Google"}
          onClick={handleGoogle}
          disabled={loading !== null}
        />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {isSignup && (
          <Field id="name" label="Name" error={errors.name}>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Alex Morgan"
              className="h-11 bg-card"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
              aria-invalid={!!errors.name}
            />
          </Field>
        )}

        <Field id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 bg-card"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError("email");
            }}
            aria-invalid={!!errors.email}
          />
        </Field>

        <Field
          id="password"
          label="Password"
          error={errors.password}
          action={
            !isSignup && (
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            )
          }
        >
          <PasswordInput
            id="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError("password");
            }}
            aria-invalid={!!errors.password}
          />
        </Field>

        {errors.form && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.form}
          </p>
        )}

        <Button type="submit" size="lg" className="h-11 w-full" disabled={loading !== null}>
          {loading === "email" && <LoaderCircle className="animate-spin" />}
          {isSignup ? "Create account" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignup ? "Already have an account? " : "New to SocialFlow? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-primary hover:underline"
        >
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  action,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
