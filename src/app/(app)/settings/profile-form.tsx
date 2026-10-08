"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sameTimeZone } from "@/components/timezone-warning";
import { timeZoneLabel } from "@/lib/timezone";
import { updateProfile, type ProfileFormState } from "./actions";

const noSubscribe = () => () => {};

export function ProfileForm({
  name,
  email,
  timezone,
  timezones,
}: {
  name: string;
  email: string;
  timezone: string;
  timezones: string[];
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    updateProfile,
    {}
  );
  const [zone, setZone] = useState(timezone);
  const [dirty, setDirty] = useState(false);

  // The time zone this browser is in, offered as a one-click choice.
  // The server can't know it, so it renders nothing there (null) and the browser fills it in.
  const browserZone = useSyncExternalStore(
    noSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null
  );

  return (
    <form action={formAction} onChange={() => setDirty(true)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="full_name">Name</Label>
        <Input id="full_name" name="full_name" defaultValue={name} className="h-11 bg-card" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled className="h-11" />
        <p className="text-xs text-muted-foreground">Your login email can&apos;t be changed here.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Time zone</Label>
        <select
          id="timezone"
          name="timezone"
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {/* Include the chosen zone even if the list spells it differently (e.g. Asia/Kolkata vs Asia/Calcutta). */}
          {(timezones.includes(zone) ? timezones : [zone, ...timezones]).map((tz) => (
            <option key={tz} value={tz}>
              {timeZoneLabel(tz)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Scheduled posts go out at this time zone&apos;s clock.
          {browserZone && !sameTimeZone(browserZone, zone) && (
            <>
              {" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  // Pick the list's own spelling of this zone, so it isn't listed twice.
                  setZone(timezones.find((tz) => sameTimeZone(tz, browserZone)) ?? browserZone);
                  setDirty(true);
                }}
              >
                Use {timeZoneLabel(browserZone)}
              </button>
            </>
          )}
        </p>
      </div>

      {state.error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          size="lg"
          className="h-11 px-6"
          disabled={pending}
          onClick={() => setDirty(false)}
        >
          {pending && <LoaderCircle className="animate-spin" />}
          Save changes
        </Button>
        {state.saved && !dirty && !pending && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-primary" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
