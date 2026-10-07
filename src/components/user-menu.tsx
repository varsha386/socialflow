"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";

export type CurrentUser = { name: string; email: string };

// The logged-in person's name and email, with a log out button.
export function UserMenu({ user, compact = false }: { user: CurrentUser; compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLogOut() {
    setLoading(true);
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  const logOutButton = (
    <button
      type="button"
      onClick={handleLogOut}
      disabled={loading}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Log out"
      title="Log out"
    >
      <LogOut className="size-4" />
    </button>
  );

  if (compact) return logOutButton;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-2 ring-1 ring-border">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      {logOutButton}
    </div>
  );
}
