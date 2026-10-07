"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { Logo } from "@/components/logo";
import { UserMenu, type CurrentUser } from "@/components/user-menu";

// Left sidebar on desktop; a scrollable top bar on phones.
export function AppSidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();

  const links = NAV_ITEMS.map((item) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
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
        <nav className="flex flex-1 flex-col gap-1">{links}</nav>
        <UserMenu user={user} />
      </aside>

      <header className="border-b bg-sidebar md:hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <Logo />
          <UserMenu user={user} compact />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">{links}</nav>
      </header>
    </>
  );
}
