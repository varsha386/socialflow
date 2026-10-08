"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

// Second step of logging in: the 6-digit code from the authenticator app.
export function VerifyCodeForm({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (listError || !factor) {
      setLoading(false);
      setError("Couldn't find your authenticator. Log out and log in again.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (verifyError) {
      setLoading(false);
      setCode("");
      setError(
        verifyError.message.toLowerCase().includes("invalid")
          ? "That code didn't work. Codes change every 30 seconds, so try the current one."
          : verifyError.message
      );
      return;
    }
    // refresh() makes the server see the upgraded login.
    router.replace(next);
    router.refresh();
  }

  return (
    <div>
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <ShieldCheck className="size-6" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Enter your code</h1>
      <p className="mt-2 text-muted-foreground">
        Open your authenticator app and type the 6-digit code for SocialFlow.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            aria-invalid={!!error}
            className="h-12 bg-card text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
          {loading && <LoaderCircle className="animate-spin" />}
          Continue
        </Button>
      </form>

      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/login");
          router.refresh();
        }}
        className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Not you? Log out
      </button>
    </div>
  );
}
