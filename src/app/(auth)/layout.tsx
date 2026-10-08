import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { PlatformBadge } from "@/components/platform-badge";
import { PLATFORMS } from "@/lib/platforms";

const perks = [
  "Instagram, Facebook and YouTube in one place",
  "Schedule weeks ahead",
  "See how every post performs",
];

// Shared layout for /login, /signup and /forgot-password:
// the form on the left, a welcome panel on the right (desktop only).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to the{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <div className="hidden p-4 lg:block">
        <div className="flex h-full flex-col justify-center rounded-3xl bg-primary p-12 text-primary-foreground">
          <h2 className="text-4xl font-semibold leading-tight">
            Write once.
            <br />
            Post everywhere.
          </h2>
          <ul className="mt-8 space-y-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3">
                <span className="flex size-6 items-center justify-center rounded-full bg-white/20">
                  <Check className="size-4" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex gap-3">
            {PLATFORMS.map((p) => (
              <span key={p.id} className="rounded-2xl ring-4 ring-white/25">
                <PlatformBadge platform={p} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
