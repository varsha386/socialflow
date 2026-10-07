// Login functions used by the login, sign-up, forgot-password and
// reset-password forms. They all talk to Supabase Auth from the browser.

import { createClient } from "@/lib/supabase/client";

export type AuthResult = { error?: string; needsEmailConfirmation?: boolean };

// Supabase sends people back to /auth/callback after email links and Google login.
function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

// Turns Supabase's technical messages into friendly ones.
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Try again.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox for the link.";
  if (m.includes("already registered")) return "An account with this email already exists. Try logging in.";
  if (m.includes("provider is not enabled")) return "Google login isn't set up yet. Use email for now.";
  if (m.includes("rate limit")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("password should be")) return "Choose a stronger password (at least 8 characters).";
  if (m.includes("invalid api key") || m.includes("no api key")) return "SocialFlow can't reach the login service. Check the Supabase key in .env.local.";
  return message;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: friendly(error.message) } : {};
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: callbackUrl("/dashboard"),
    },
  });
  if (error) return { error: friendly(error.message) };
  // With email confirmation turned on, there's no session until they click the link.
  return { needsEmailConfirmation: !data.session };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = createClient();
  // On success the browser leaves this page and goes to Google.
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl("/dashboard") },
  });
  return error ? { error: friendly(error.message) } : {};
}

export async function sendPasswordResetEmail(email: string): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl("/reset-password"),
  });
  return error ? { error: friendly(error.message) } : {};
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: friendly(error.message) } : {};
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
