"use client";

import { useTransition } from "react";
import { LoaderCircle, Unplug } from "lucide-react";
import { disconnectAccount } from "./actions";

export function DisconnectButton({ accountId, name }: { accountId: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Disconnect ${name}? Scheduled posts to it won't be published.`)) return;
        startTransition(() => disconnectAccount(accountId));
      }}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label={`Disconnect ${name}`}
      title="Disconnect"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Unplug className="size-4" />}
    </button>
  );
}
