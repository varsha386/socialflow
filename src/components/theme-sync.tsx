"use client";

import { useLayoutEffect } from "react";
import { applyTheme, subscribeTheme } from "@/lib/theme";

// Keeps the page's light/dark look up to date: when the computer switches theme,
// when another tab changes it, and after React's development-only remount
// (which removes the "dark" class the <head> script added).
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme();
    return subscribeTheme(() => applyTheme());
  }, []);
  return null;
}
