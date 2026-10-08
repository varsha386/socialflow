import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

// Shown for any address that doesn't exist (and for posts that aren't yours).
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Logo />
      <div>
        <p className="text-6xl font-semibold text-primary">404</p>
        <h1 className="mt-2 text-xl font-medium">This page doesn&apos;t exist</h1>
        <p className="mt-1 text-muted-foreground">The link may be old, or the post may have been deleted.</p>
      </div>
      <div className="flex gap-3">
        <Link href="/dashboard" className={buttonVariants()}>
          Go to Dashboard
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Home page
        </Link>
      </div>
    </div>
  );
}
