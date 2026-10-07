import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  // /auth/callback sends people here with ?error=link when an email link has expired.
  const initialError =
    error === "link" ? "That link has expired or was already used. Try again." : undefined;

  return <AuthForm mode="login" initialError={initialError} />;
}
