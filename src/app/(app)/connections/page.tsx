import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, CircleCheck, Plug, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PlatformBadge } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSocialAccounts } from "@/lib/data";
import { PLATFORMS, type PlatformId, type ProviderId } from "@/lib/platforms";
import { FREE_LIMITS } from "@/lib/plans";
import { AddAccount } from "./add-account";
import { DisconnectButton } from "./disconnect-button";

export const metadata: Metadata = { title: "Connections" };

const PROVIDER_NAMES: Record<ProviderId, string> = {
  meta: "Facebook and Instagram",
  youtube: "YouTube",
  bluesky: "Bluesky",
};

// Turns the ?connected=… or ?error=… left by /api/connect (or the Bluesky form) into a message.
function resultMessage(params: Record<string, string | string[] | undefined>) {
  const provider = String(params.provider ?? params.connected ?? "") as ProviderId;
  const name = PROVIDER_NAMES[provider] ?? "that account";

  if (params.connected) {
    const count = Number(params.count ?? 1);
    const skipped = Number(params.skipped ?? 0);
    const limitNote = skipped
      ? ` ${skipped} more ${skipped === 1 ? "wasn't" : "weren't"} added, because the Free plan includes ${FREE_LIMITS.accounts} accounts. Upgrade to Pro on the Plan page for unlimited.`
      : "";
    if (provider === "youtube") return { ok: true, text: `Your YouTube channel is connected.${limitNote}` };
    if (provider === "bluesky") return { ok: true, text: "Your Bluesky account is connected." };
    return {
      ok: true,
      text: `Connected ${count} ${count === 1 ? "account" : "accounts"} from Facebook and Instagram.${limitNote}`,
    };
  }

  switch (params.error) {
    case undefined:
      return null;
    case "not_configured":
      return { ok: false, text: `${name} isn't set up yet. Its keys are missing from the app's settings.` };
    case "cancelled":
      return { ok: false, text: `You cancelled connecting ${name}.` };
    case "expired":
      return { ok: false, text: "That took too long or the page was reloaded. Try connecting again." };
    case "no_channel":
      return {
        ok: false,
        text: "No YouTube channel was found on the account you picked. If your channel uses a Brand Account, choose the channel's name (not your own) when Google asks. Otherwise, create a channel on youtube.com first.",
      };
    case "plan_limit":
      return {
        ok: false,
        text: `The Free plan includes ${FREE_LIMITS.accounts} connected accounts, and you've reached it. Upgrade to Pro on the Plan page to connect more.`,
      };
    case "no_pages":
      return { ok: false, text: "No Facebook Pages were found. When Facebook asks, make sure you select your Page (and its Instagram account)." };
    default:
      return { ok: false, text: `Something went wrong connecting ${name}. Try again.` };
  }
}

export default async function ConnectionsPage({ searchParams }: PageProps<"/connections">) {
  const [accounts, params] = await Promise.all([getSocialAccounts(), searchParams]);
  const message = resultMessage(params);
  // ?add=1 shows the platform list; ?add=bluesky shows Bluesky's form.
  const add = typeof params.add === "string" ? params.add : null;
  const step = add && PLATFORMS.some((p) => p.id === add) ? (add as PlatformId) : add ? "pick" : null;

  // Accounts in the order platforms are listed, so each platform's accounts sit together.
  const order = (id: PlatformId) => PLATFORMS.findIndex((p) => p.id === id);
  const sorted = [...accounts].sort((a, b) => order(a.platform) - order(b.platform));

  return (
    <>
      <PageHeader title="Connections" description="The accounts SocialFlow can post to.">
        {!step && (
          <Link href="/connections?add=1" className={buttonVariants({ size: "lg" })}>
            <Plus />
            Add account
          </Link>
        )}
      </PageHeader>

      {message && (
        <div
          role="status"
          className={
            message.ok
              ? "mb-6 flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground"
              : "mb-6 flex items-center gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {message.ok ? <CircleCheck className="size-4 shrink-0" /> : <CircleAlert className="size-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {step && <AddAccount step={step} />}

      {sorted.length === 0 ? (
        !step && (
          <div className="flex flex-col items-center rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Plug className="size-6" />
            </span>
            <h2 className="font-medium">No accounts yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add the social accounts you want to post to. You can connect as many or as few as you like.
            </p>
            <Link href="/connections?add=1" className={buttonVariants({ className: "mt-4" })}>
              <Plus />
              Add account
            </Link>
          </div>
        )
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {sorted.map((a) => {
              const platform = PLATFORMS.find((p) => p.id === a.platform)!;
              const name = a.display_name ?? a.username ?? platform.name;
              const reconnectHref =
                platform.connectWith === "oauth" ? `/api/connect/${platform.provider}` : `/connections?add=${platform.id}`;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="relative shrink-0">
                    {a.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.avatar_url} alt="" referrerPolicy="no-referrer" className="size-10 rounded-full object-cover" />
                    ) : (
                      <span className="block size-10 rounded-full bg-accent" />
                    )}
                    <span className="absolute -right-1 -bottom-1 origin-bottom-right scale-50">
                      <PlatformBadge platform={platform} />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{name}</p>
                    <p className="truncate text-muted-foreground">
                      {platform.name}
                      {a.username && ` · @${a.username}`}
                    </p>
                  </div>
                  {a.status === "connected" ? (
                    <Badge>Connected</Badge>
                  ) : (
                    <>
                      <Badge variant="destructive">Needs reconnecting</Badge>
                      {platform.connectWith === "oauth" ? (
                        <a href={reconnectHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
                          Reconnect
                        </a>
                      ) : (
                        <Link href={reconnectHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
                          Reconnect
                        </Link>
                      )}
                    </>
                  )}
                  <DisconnectButton accountId={a.id} name={name} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
