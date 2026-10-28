"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { createPinterestBoard, getPinterestBoards } from "@/app/(app)/create/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PINTEREST_TITLE_LIMIT, type PinterestOptions } from "@/lib/post-rules";
import type { SocialAccount } from "@/lib/types";
import { cn } from "@/lib/utils";

type Board = { id: string; name: string };

// Pinterest's extra fields on Create: a board for each chosen Pinterest account, then a
// title and link shared by all of them.
export function PinterestOptionsPanel({
  accounts,
  value,
  onChange,
  sandbox,
}: {
  accounts: SocialAccount[]; // the chosen Pinterest accounts
  value: PinterestOptions;
  onChange: Dispatch<SetStateAction<PinterestOptions>>;
  sandbox: boolean;
}) {
  const setBoard = (accountId: string, boardId: string) =>
    onChange((v) => ({ ...v, boards: { ...v.boards, [accountId]: boardId } }));

  return (
    <div className="space-y-3 rounded-2xl bg-muted p-4">
      {accounts.map((a) => (
        <BoardPicker
          key={a.id}
          account={a}
          label={accounts.length > 1 ? `Board for ${a.display_name ?? a.username}` : "Pinterest board"}
          value={value.boards[a.id] ?? ""}
          onChange={(boardId) => setBoard(a.id, boardId)}
        />
      ))}
      <div className="space-y-2">
        <Label htmlFor="pin-title">Pin title (optional)</Label>
        <Input
          id="pin-title"
          value={value.title}
          onChange={(e) => onChange((v) => ({ ...v, title: e.target.value }))}
          placeholder="What's this Pin about?"
          className="h-10 bg-card"
        />
        <p className={cn("text-xs text-muted-foreground", value.title.length > PINTEREST_TITLE_LIMIT && "text-destructive")}>
          {value.title.length}/{PINTEREST_TITLE_LIMIT}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin-link">Link (optional)</Label>
        <Input
          id="pin-link"
          type="url"
          value={value.link}
          onChange={(e) => onChange((v) => ({ ...v, link: e.target.value }))}
          placeholder="https://your-site.com/page"
          className="h-10 bg-card"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        The caption becomes the Pin&apos;s description. Pins need a photo; videos aren&apos;t supported yet.
        {sandbox && " While Pinterest is reviewing SocialFlow, Pins are only visible to you."}
      </p>
    </div>
  );
}

function BoardPicker({
  account,
  label,
  value,
  onChange,
}: {
  account: SocialAccount;
  label: string;
  value: string;
  onChange: (boardId: string) => void;
}) {
  const [result, setResult] = useState<{ boards?: Board[]; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPinterestBoards(account.id).then((r) => {
      if (cancelled) return;
      setResult(r);
      // With just one board, there's nothing to choose.
      if (r.boards?.length === 1 && !value) onChange(r.boards[0].id);
    });
    return () => {
      cancelled = true;
    };
    // Load once per account (and on "Try again"), not every time the choice changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, attempt]);

  async function create() {
    setCreating(true);
    setCreateError(null);
    const r = await createPinterestBoard(account.id, newName);
    setCreating(false);
    if (r.error || !r.board) {
      setCreateError(r.error ?? "Couldn't create the board.");
      return;
    }
    const board = r.board;
    setResult((prev) => ({ boards: [...(prev?.boards ?? []), board].sort((a, b) => a.name.localeCompare(b.name)) }));
    setNewName("");
    onChange(board.id);
  }

  const id = `pin-board-${account.id}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {!result ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading boards…
        </p>
      ) : result.error ? (
        <p className="text-sm text-destructive">
          {result.error}{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              setResult(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </p>
      ) : (
        <>
          {result.boards!.length > 0 ? (
            <select
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
            >
              <option value="">Choose a board</option>
              {result.boards!.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted-foreground">No boards yet. Make one here:</p>
          )}
          <div className="flex gap-2">
            <Input
              aria-label="New board name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New board name"
              maxLength={50}
              className="h-9 bg-card"
            />
            <Button type="button" variant="outline" size="sm" className="h-9" disabled={creating || !newName.trim()} onClick={create}>
              {creating ? <LoaderCircle className="animate-spin" /> : <Plus />}
              New board
            </Button>
          </div>
          {createError && <p className="text-xs text-destructive">{createError}</p>}
        </>
      )}
    </div>
  );
}
