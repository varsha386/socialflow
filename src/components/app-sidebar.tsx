"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, isGroup, type NavGroup, type NavLink } from "@/lib/nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu, type CurrentUser } from "@/components/user-menu";

// Left sidebar on desktop; on phones, a top bar with a ☰ button that opens the full menu.
// Pages are grouped (Create, Posts, Schedule…); each group opens and closes, and the
// group holding the current page opens by itself.
export function AppSidebar({ user, failedCount }: { user: CurrentUser; failedCount: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  // Groups the person opened or closed by hand; the rest follow the current page.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

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

  // A link is current when its page matches, and for Posts tabs, its ?status too.
  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (query) return pathname === path && searchParams.get("status") === new URLSearchParams(query).get("status");
    if (path === "/posts") return pathname === "/posts" && !searchParams.get("status");
    return pathname === path || pathname.startsWith(path + "/");
  };

  const renderLink = (item: NavLink, nested = false) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    const count = item.badge === "failed" ? failedCount : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex shrink-0 items-center gap-3 rounded-full px-4 py-2 text-sm transition-colors",
          nested && "pl-11",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {!nested && <Icon className="size-4" />}
        <span className="flex-1">{item.label}</span>
        {count > 0 && (
          <span
            className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-xs font-semibold text-white"
            aria-label={`${count} failed`}
          >
            {count}
          </span>
        )}
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const containsCurrent = group.items.some((item) => isActive(item.href));
    const expanded = toggled[group.label] ?? containsCurrent;
    const id = `nav-${group.label.toLowerCase()}`;
    const Icon = group.icon;
    const failed = group.items.some((i) => i.badge === "failed") ? failedCount : 0;
    return (
      <div key={group.label}>
        <button
          type="button"
          onClick={() => setToggled((t) => ({ ...t, [group.label]: !expanded }))}
          aria-expanded={expanded}
          aria-controls={id}
          className={cn(
            "flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors hover:bg-muted hover:text-foreground",
            containsCurrent ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          <Icon className="size-4" />
          <span className="flex-1 text-left">{group.label}</span>
          {!expanded && failed > 0 && (
            <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-xs font-semibold text-white">
              {failed}
            </span>
          )}
          <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} />
        </button>
        {expanded && (
          <div id={id} className="mt-0.5 flex flex-col gap-0.5">
            {group.items.map((item) => renderLink(item, true))}
          </div>
        )}
      </div>
    );
  };

  const menu = NAV.map((entry) => (isGroup(entry) ? renderGroup(entry) : renderLink(entry)));

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r bg-sidebar px-3 py-5 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav aria-label="Main menu" className="-mx-1 flex flex-1 flex-col gap-1 overflow-y-auto px-1">
          {menu}
        </nav>
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
              aria-label={open ? "Close menu" : failedCount ? `Open menu (${failedCount} failed posts)` : "Open menu"}
              className="relative flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
              {!open && failedCount > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" aria-hidden="true" />
              )}
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
              {menu}
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
