"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { setTimezone } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { timeZoneLabel } from "@/lib/timezone";

const noSubscribe = () => () => {};
const pretty = timeZoneLabel;

// True if two names are the same zone, e.g. "Asia/Calcutta" and "Asia/Kolkata".
export function sameTimeZone(a: string, b: string) {
  const canonical = (tz: string) => {
    try {
      return new Intl.DateTimeFormat("en", { timeZone: tz }).resolvedOptions().timeZone;
    } catch {
      return tz;
    }
  };
  return canonical(a) === canonical(b);
}

// Warns when the profile's time zone doesn't match this computer's, because
// scheduled times are read in the profile's time zone. Shows nothing if they match.
export function TimezoneWarning({ timezone }: { timezone: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The server can't know the browser's time zone, so it renders nothing there.
  const browserZone = useSyncExternalStore(
    noSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null
  );

  if (!browserZone || sameTimeZone(browserZone, timezone)) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <TriangleAlert className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        Your SocialFlow time zone is <strong>{pretty(timezone)}</strong>, but this computer is on{" "}
        <strong>{pretty(browserZone)}</strong>. Scheduled times use {pretty(timezone)}.
        {error && <span className="block text-destructive">{error}</span>}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="bg-card"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setTimezone(browserZone);
            if (result.error) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending && <LoaderCircle className="animate-spin" />}
        Use {pretty(browserZone)}
      </Button>
    </div>
  );
}
