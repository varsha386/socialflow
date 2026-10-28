"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, LoaderCircle, X } from "lucide-react";
import { PlatformBadge } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMING_SOON, PLATFORMS, type PlatformId } from "@/lib/platforms";
import { connectBluesky } from "./actions";

// "Add account": pick a platform, then connect it. `step` comes from the address
// (?add=1 for the list, ?add=bluesky for Bluesky's form), so Back works.
export function AddAccount({ step, notReady }: { step: "pick" | PlatformId; notReady: PlatformId[] }) {
  const ready = PLATFORMS.filter((p) => !notReady.includes(p.id));
  const comingSoon = [...PLATFORMS.filter((p) => notReady.includes(p.id)).map((p) => p.name), ...COMING_SOON];
  const bluesky = PLATFORMS.find((p) => p.id === "bluesky")!;

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{step === "bluesky" ? "Connect Bluesky" : "Add an account"}</CardTitle>
          <CardDescription>
            {step === "bluesky"
              ? "Use an app password, so SocialFlow never needs your real Bluesky password."
              : "Choose where you want to post. Connect only the ones you use."}
          </CardDescription>
        </div>
        <Link
          href="/connections"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {step === "bluesky" ? (
          <BlueskyForm platformName={bluesky.name} />
        ) : (
          <div className="space-y-5">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ready.map((p) => {
                const tile = (
                  <>
                    <PlatformBadge platform={p} />
                    <span className="min-w-0">
                      <span className="block font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.description}</span>
                    </span>
                  </>
                );
                const className =
                  "flex h-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors hover:border-primary hover:bg-accent/50";
                return (
                  <li key={p.id}>
                    {p.connectWith === "oauth" ? (
                      // A plain link (not <Link>) because it leaves the site for Google/Facebook.
                      <a href={`/api/connect/${p.provider}`} className={className}>
                        {tile}
                      </a>
                    ) : (
                      <Link href={`/connections?add=${p.id}`} className={className}>
                        {tile}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              Facebook and Instagram use the same Facebook login: choosing either lets you pick your Pages and
              their linked Instagram accounts.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Coming soon:</span>
              {comingSoon.map((name) => (
                <span key={name} className="rounded-full border border-dashed px-3 py-1 text-muted-foreground">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlueskyForm({ platformName }: { platformName: string }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await connectBluesky(handle, password);
          if (result.error) {
            setError(result.error);
            return;
          }
          setPassword("");
          router.push("/connections?connected=bluesky");
        });
      }}
    >
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          In {platformName}, open <span className="font-medium text-foreground">Settings → Privacy and security → App passwords</span>{" "}
          and add one named “SocialFlow”.{" "}
          <a
            href="https://bsky.app/settings/app-passwords"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
          >
            Open it <ExternalLink className="size-3" />
          </a>
        </li>
        <li>Copy the password it shows, and paste it below with your handle.</li>
      </ol>

      <div className="space-y-2">
        <Label htmlFor="bsky-handle">Handle</Label>
        <Input
          id="bsky-handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="yourname.bsky.social"
          autoComplete="username"
          spellCheck={false}
          className="h-11 bg-card"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bsky-password">App password</Label>
        <Input
          id="bsky-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="xxxx-xxxx-xxxx-xxxx"
          autoComplete="off"
          className="h-11 bg-card"
        />
        <p className="text-xs text-muted-foreground">
          Stored encrypted. You can remove it in {platformName} at any time, and it can&apos;t change your account
          password.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" className="h-11 px-6" disabled={pending || !handle.trim() || !password.trim()}>
          {pending && <LoaderCircle className="animate-spin" />}
          Connect {platformName}
        </Button>
        <Link href="/connections?add=1" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Other platforms
        </Link>
      </div>
    </form>
  );
}
