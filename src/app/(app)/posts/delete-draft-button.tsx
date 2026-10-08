"use client";

import { useTransition } from "react";
import { LoaderCircle, Trash } from "lucide-react";
import { deleteDraft } from "@/app/(app)/create/actions";

export function DeleteDraftButton({ postId }: { postId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this draft? This can't be undone.")) return;
        startTransition(() => deleteDraft(postId));
      }}
      className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label="Delete draft"
      title="Delete draft"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash className="size-4" />}
    </button>
  );
}
