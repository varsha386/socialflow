// Light, dark or "system" (follow the computer's setting).
// The choice is kept in this browser's localStorage, so it needs no database.

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const CHANGE_EVENT = "themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// Runs in <head> before the page is painted, so dark mode never flashes white first.
// Keep it in step with getTheme() and isDark() below.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system"; // localStorage can be blocked (e.g. some private windows)
  }
}

export function isDark(theme: Theme = getTheme()) {
  return theme === "dark" || (theme === "system" && matchMedia(DARK_QUERY).matches);
}

export function applyTheme(theme: Theme = getTheme()) {
  document.documentElement.classList.toggle("dark", isDark(theme));
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not saved, but still applied to this page.
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Calls `onChange` when the theme is changed here, in another tab, or by the computer's setting.
export function subscribeTheme(onChange: () => void) {
  const media = matchMedia(DARK_QUERY);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onChange);
  };
}
