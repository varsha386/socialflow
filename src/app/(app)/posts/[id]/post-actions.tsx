"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// "Retry failed" button: publishes the post again, skipping accounts that already worked.
export function RetryButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, { method: "POST" });
      const body = (await res.json()) as { error?: string };
      if (body.error) setError(body.error);
    } catch {
      setError("Couldn't reach SocialFlow. Check your connection and try again.");
    }
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" onClick={retry} disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : <RotateCw />}
        {pending ? "Publishing…" : "Retry failed"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}

// While a post is publishing (e.g. in another tab), re-check every few seconds.
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
