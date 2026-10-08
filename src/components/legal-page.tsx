import Link from "next/link";
import { Logo } from "@/components/logo";
import { SITE } from "@/lib/site";

// Simple reading layout for the Privacy Policy and Terms pages.
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-3xl px-4 py-5">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {SITE.lastUpdated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-7 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <span>© {new Date().getFullYear()} {SITE.name}</span>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms of Service
        </Link>
      </nav>
    </footer>
  );
}
