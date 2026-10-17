"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

// Choose light, dark, or follow the computer's setting. Saved in this browser only.
export function AppearanceCard() {
  // The server can't read this browser's choice, so it shows nothing selected until the page loads.
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => null);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose light or dark, or let SocialFlow follow your computer&apos;s setting. Saved on this
          browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-accent font-medium text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-5" />
                {label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
