"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Setup = { factorId: string; qrCode: string; secret: string };

// Turn two-step login (an authenticator app code at login) on or off.
export function TwoStepCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  async function start() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    // Remove any half-finished setup from before, so we can start fresh.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "SocialFlow authenticator",
      issuer: "SocialFlow",
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? "Couldn't start setup. Try again.");
      return;
    }
    setSetup({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setup) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code shown in your app");
      return;
    }
    setBusy(true);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({
      factorId: setup.factorId,
      code,
    });
    setBusy(false);
    if (verifyError) {
      setCode("");
      setError("That code didn't work. Check your phone's clock is correct, and try the current code.");
      return;
    }
    setSetup(null);
    setCode("");
    setJustEnabled(true);
    router.refresh();
  }

  async function turnOff() {
    if (!window.confirm("Turn off two-step login? Your account will only be protected by your password.")) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    for (const f of data?.all ?? []) {
      if (f.factor_type === "totp") {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (removeError) {
          setBusy(false);
          setError(removeError.message);
          return;
        }
      }
    }
    // Get a fresh login token that no longer lists the removed factor.
    await supabase.auth.refreshSession();
    setBusy(false);
    setJustEnabled(false);
    router.refresh();
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-step login
          {enabled && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">On</span>
          )}
        </CardTitle>
        <CardDescription>
          After your password, also enter a code from an authenticator app on your phone, so a stolen password
          isn&apos;t enough to get in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled && !setup && (
          <>
            <p className="flex items-start gap-2 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              {justEnabled
                ? "Two-step login is on. You'll be asked for a code next time you log in, and other devices were logged out."
                : "Two-step login is on. You'll be asked for a code each time you log in."}
            </p>
            <Button variant="outline" onClick={turnOff} disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <ShieldOff />}
              Turn off
            </Button>
          </>
        )}

        {!enabled && !setup && (
          <Button onClick={start} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            Turn on two-step login
          </Button>
        )}

        {setup && (
          <form onSubmit={confirm} className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>
                Install an authenticator app on your phone, like Google Authenticator or Microsoft Authenticator.
              </li>
              <li>In the app, add an account and scan this QR code.</li>
              <li>Type the 6-digit code the app shows.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qrCode} alt="QR code for your authenticator app" className="size-44 rounded-xl bg-white p-2 ring-1 ring-border" />
              <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                <p>Can&apos;t scan? Enter this key in the app instead:</p>
                <p className="mt-1 font-mono text-sm break-all text-foreground select-all">{setup.secret}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-code">6-digit code</Label>
              <Input
                id="setup-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                className="h-11 w-40 bg-card text-center text-lg tracking-[0.4em]"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={busy}>
                {busy && <LoaderCircle className="animate-spin" />}
                Turn on
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSetup(null);
                  setCode("");
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Lost your phone? The project owner can remove two-step login for your account in the Supabase dashboard
          (Authentication → Users).
        </p>
      </CardContent>
    </Card>
  );
}
