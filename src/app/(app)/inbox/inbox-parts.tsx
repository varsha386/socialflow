"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, RefreshCw, Reply, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshInbox, sendReply } from "./actions";

export function RefreshInboxButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {error && <span className="text-sm text-destructive">{error}</span>}
      <Button
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await refreshInbox();
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
        {pending ? "Checking…" : "Refresh"}
      </Button>
    </div>
  );
}

// "Reply" link that opens a small box under a comment thread.
export function ReplyBox({ commentId, replyingTo }: { commentId: string; replyingTo: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <Reply className="size-4" />
        Reply
      </button>
    );
  }

  function submit() {
    if (!text.trim()) {
      setError("Write a reply first.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await sendReply(commentId, text);
      if (result.error) setError(result.error);
      else {
        setText("");
        setOpen(false);
      }
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
        }}
        rows={2}
        placeholder={`Reply to ${replyingTo}…`}
        disabled={pending}
        className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
          Send reply
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">Ctrl+Enter to send</span>
        {error && <span className="w-full text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
