import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

// People land here from the password-reset email (via /auth/callback, which logs them in).
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
