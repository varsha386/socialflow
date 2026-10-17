"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { isDark, setTheme, subscribeTheme } from "@/lib/theme";

// One-click switch between light and dark, shown next to the log out button.
export function ThemeToggle() {
  // The server can't know the theme, so it renders the light-mode icon and the browser corrects it.
  const dark = useSyncExternalStore(subscribeTheme, () => isDark(), () => false);
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={label}
      title={label}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
