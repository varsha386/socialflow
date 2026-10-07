import Link from "next/link";
import { ArrowRight, CalendarClock, ChartColumn, Send } from "lucide-react";
import { Logo } from "@/components/logo";
import { PlatformBadge } from "@/components/platform-badge";
import { buttonVariants } from "@/components/ui/button";
import { PLATFORMS } from "@/lib/platforms";

const features = [
  {
    icon: Send,
    title: "Post everywhere at once",
    text: "Write one post and publish it to all your accounts, with a custom caption for each.",
  },
  {
    icon: CalendarClock,
    title: "Schedule ahead",
    text: "Pick a date and time, and SocialFlow publishes for you. See it all in a calendar.",
  },
  {
    icon: ChartColumn,
    title: "Track what works",
    text: "Views, likes, and comments from every platform in one dashboard.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Log in
          </Link>
          <Link href="/signup" className={buttonVariants()}>
            Sign up
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="py-16 text-center md:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Write once. Post everywhere.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Create, schedule, and publish to all your social media accounts from one simple dashboard.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Get started
              <ArrowRight />
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {PLATFORMS.map((p) => (
              <PlatformBadge key={p.id} platform={p} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 pb-24 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-3xl border bg-card p-6 shadow-sm">
              <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <f.icon className="size-5" />
              </span>
              <h2 className="font-medium">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SocialFlow
      </footer>
    </div>
  );
}
