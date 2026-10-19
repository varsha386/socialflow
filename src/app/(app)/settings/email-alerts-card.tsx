"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EMAIL_ALERTS, type EmailAlert, type EmailAlertSettings } from "@/lib/email/alert-options";
import { cn } from "@/lib/utils";
import { setEmailAlert } from "./actions";

// On/off switches for each kind of email. Each switch saves as soon as it's flipped.
export function EmailAlertsCard({ email, initial }: { email: string; initial: EmailAlertSettings }) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(key: EmailAlert) {
    const on = !settings[key];
    setError(null);
    setSettings((s) => ({ ...s, [key]: on })); // show it straight away
    startTransition(async () => {
      const result = await setEmailAlert(key, on);
      if (result.error) {
        setError(result.error);
        setSettings((s) => ({ ...s, [key]: !on })); // put it back
      }
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Email alerts</CardTitle>
        <CardDescription>Sent to {email} about things that happen while you&apos;re away.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {EMAIL_ALERTS.map((alert) => {
          const on = settings[alert.key];
          return (
            <div key={alert.key} className="flex items-start justify-between gap-4 rounded-2xl px-1 py-3">
              <div>
                <p id={`${alert.key}-label`} className="text-sm font-medium">
                  {alert.label}
                </p>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`${alert.key}-label`}
                disabled={pending}
                onClick={() => toggle(alert.key)}
                className={cn(
                  "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70",
                  on ? "bg-primary" : "bg-input"
                )}
              >
                <span
                  className={cn(
                    "inline-block size-5 rounded-full bg-card shadow-sm transition-transform",
                    on ? "translate-x-5.5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          );
        })}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
