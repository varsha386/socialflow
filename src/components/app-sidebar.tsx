"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu, type CurrentUser } from "@/components/user-menu";

// Left sidebar on desktop; on phones, a top bar with a ☰ button that opens the full menu.
export function AppSidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // While the phone menu is open: Escape closes it, and the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = NAV_ITEMS.map((item) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="size-4" />
        {item.label}
      </Link>
    );
  });

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r bg-sidebar px-3 py-5 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="-mx-1 flex flex-1 flex-col gap-1 overflow-y-auto px-1">{links}</nav>
        <UserMenu user={user} />
      </aside>

      <header className="sticky top-0 z-40 border-b bg-sidebar md:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Fills the screen below the bar (61px = the bar's height: 36px buttons + padding + border). */}
        {open && (
          <div
            id="mobile-menu"
            className="fixed inset-x-0 top-[61px] bottom-0 flex flex-col gap-4 overflow-y-auto border-t bg-sidebar px-3 py-4"
          >
            <nav aria-label="Main menu" className="flex flex-col gap-1">
              {links}
            </nav>
            <div className="mt-auto">
              <UserMenu user={user} />
            </div>
          </div>
        )}
      </header>
    </>
  );
}
