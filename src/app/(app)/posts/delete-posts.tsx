"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deletePosts, type DeletePostsResult } from "./actions";

export type LiveCopy = { account: string; platform: string }; // where a post is live, e.g. "My Page" on "Facebook"

// The confirmation shown before deleting: explains what happens, and offers to delete
// the live copies from the platforms too.
function ConfirmDelete({
  count,
  live,
  onDone,
  onCancel,
  postIds,
}: {
  count: number;
  live: LiveCopy[];
  postIds: string[];
  onDone: (result: DeletePostsResult) => void;
  onCancel: () => void;
}) {
  const [fromPlatforms, setFromPlatforms] = useState(false);
  const [pending, startTransition] = useTransition();
  const what = count === 1 ? "this post" : `these ${count} posts`;

  return (
    <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">Delete {what}?</p>
      {live.length > 0 ? (
        <>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={fromPlatforms}
              onChange={(e) => setFromPlatforms(e.target.checked)}
              className="mt-0.5 size-4 accent-(--destructive)"
            />
            <span>
              Also delete {count === 1 ? "it" : "them"} from the platforms, where {count === 1 ? "it's" : "they're"} live on:{" "}
              <span className="text-muted-foreground">
                {live.map((l) => (l.platform ? `${l.account} (${l.platform})` : l.account)).join(", ")}
              </span>
            </span>
          </label>
          <p className="text-muted-foreground">
            {fromPlatforms
              ? "This deletes the live posts and can't be undone. If a platform refuses, the post stays in Ripple so you can try again."
              : "Only removes it from Ripple. The live posts stay on the platforms. Its analytics and comments in Ripple are removed too."}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">Nothing was published, so this only removes it from Ripple.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => startTransition(async () => onDone(await deletePosts(postIds, fromPlatforms)))}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Trash />}
          {fromPlatforms ? "Delete everywhere" : "Delete from Ripple"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ResultNote({ result }: { result: DeletePostsResult }) {
  if (result.error && !result.removed && !result.kept.length) return <p className="text-sm text-destructive">{result.error}</p>;
  return (
    <div className="space-y-1 text-sm">
      {result.removed > 0 && (
        <p className="text-muted-foreground">
          Deleted {result.removed} {result.removed === 1 ? "post" : "posts"}.
        </p>
      )}
      {result.kept.map((k) => (
        <p key={k.postId} className="text-destructive">
          Kept in Ripple: {k.reason}
          {k.results.some((r) => r.ok) && ` (Deleted from: ${k.results.filter((r) => r.ok).map((r) => r.account).join(", ")}.)`}
        </p>
      ))}
      {result.error && <p className="text-destructive">{result.error}</p>}
    </div>
  );
}

// "Delete" on a post's own page.
export function DeletePostButton({ postId, live }: { postId: string; live: LiveCopy[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<DeletePostsResult | null>(null);

  if (!open) {
    return (
      <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
        <Trash />
        Delete
      </Button>
    );
  }
  return (
    <div className="w-full space-y-2">
      <ConfirmDelete
        count={1}
        live={live}
        postIds={[postId]}
        onCancel={() => setOpen(false)}
        onDone={(r) => {
          if (r.removed) router.push("/posts");
          else setResult(r);
        }}
      />
      {result && <ResultNote result={result} />}
    </div>
  );
}

// The Posts list with a "Select" mode: tick posts, then delete them together.
// Scheduled posts can't be ticked (cancel their schedule first).
export function SelectablePostList({
  items,
}: {
  items: { id: string; deletable: boolean; live: LiveCopy[]; row: ReactNode }[];
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<DeletePostsResult | null>(null);

  const deletable = items.filter((i) => i.deletable);
  const live = items.filter((i) => chosen.includes(i.id)).flatMap((i) => i.live);
  const stop = () => {
    setSelecting(false);
    setChosen([]);
    setConfirming(false);
  };

  return (
    <div className="space-y-3">
      {deletable.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {!selecting ? (
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setSelecting(true)}>
              Select
            </button>
          ) : (
            <>
              <span className="text-muted-foreground" aria-live="polite">
                {chosen.length} selected
              </span>
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setChosen(chosen.length === deletable.length ? [] : deletable.map((i) => i.id))}
              >
                {chosen.length === deletable.length ? "Clear selection" : "Select all"}
              </button>
              <button
                type="button"
                disabled={!chosen.length}
                className="font-medium text-destructive hover:underline disabled:text-muted-foreground disabled:no-underline"
                onClick={() => setConfirming(true)}
              >
                Delete selected{chosen.length ? ` (${chosen.length})` : ""}
              </button>
              <button type="button" className="font-medium hover:underline" onClick={stop}>
                Done
              </button>
            </>
          )}
        </div>
      )}

      {confirming && (
        <ConfirmDelete
          count={chosen.length}
          live={live}
          postIds={chosen}
          onCancel={() => setConfirming(false)}
          onDone={(r) => {
            setResult(r);
            stop();
            router.refresh();
          }}
        />
      )}
      {result && <ResultNote result={result} />}

      <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
        {items.map((item) => {
          const ticked = chosen.includes(item.id);
          return (
            <li key={item.id} className={cn("relative", selecting && ticked && "bg-accent/40")}>
              {selecting && (
                <button
                  type="button"
                  disabled={!item.deletable}
                  onClick={() => setChosen((c) => (ticked ? c.filter((x) => x !== item.id) : [...c, item.id]))}
                  aria-pressed={ticked}
                  aria-label={item.deletable ? "Select post" : "Scheduled posts can't be deleted; cancel the schedule first"}
                  title={item.deletable ? undefined : "Cancel the schedule first"}
                  className="absolute inset-0 z-10 flex items-center pl-2 disabled:cursor-not-allowed"
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border-2",
                      !item.deletable ? "border-muted-foreground/30" : ticked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60 bg-card"
                    )}
                  >
                    {ticked && <Check className="size-3" />}
                  </span>
                </button>
              )}
              <div className={cn(selecting && "pl-7")}>{item.row}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
