import type { Metadata } from "next";
import { VerifyCodeForm } from "@/components/auth/verify-code-form";

export const metadata: Metadata = { title: "Enter your code" };

// proxy.ts sends people here after their password (or Google) login when
// two-step login is on, with ?next= set to where they were going.
export default async function VerifyCodePage({ searchParams }: PageProps<"/verify-code">) {
  const { next } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return <VerifyCodeForm next={safeNext} />;
}
