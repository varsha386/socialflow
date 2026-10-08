"use client"; // Error screens must run in the browser

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert, RotateCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

// Shown inside the sidebar layout when a logged-in page fails to load,
// e.g. the database can't be reached. The sidebar keeps working.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </span>
      <h1 className="text-lg font-medium">This page didn&apos;t load</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Something went wrong on our side. Try again, and if it keeps happening, check your connection.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Error code: {error.digest}</p>}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => retry()}>
          <RotateCw />
          Try again
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
