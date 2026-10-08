import type { Metadata } from "next";
import { CircleAlert, CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PlatformBadge } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSocialAccounts } from "@/lib/data";
import { PLATFORMS, type ProviderId } from "@/lib/platforms";
import { DisconnectButton } from "./disconnect-button";

export const metadata: Metadata = { title: "Connections" };

const PROVIDER_NAMES: Record<ProviderId, string> = {
  meta: "Facebook and Instagram",
  youtube: "YouTube",
};

// Turns the ?connected=… or ?error=… left by /api/connect into a message.
function resultMessage(params: Record<string, string | string[] | undefined>) {
  const provider = String(params.provider ?? params.connected ?? "") as ProviderId;
  const name = PROVIDER_NAMES[provider] ?? "that account";

  if (params.connected) {
    const count = Number(params.count ?? 1);
    if (provider === "youtube") return { ok: true, text: "Your YouTube channel is connected." };
    return {
      ok: true,
      text: `Connected ${count} ${count === 1 ? "account" : "accounts"} from Facebook and Instagram.`,
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
    case "no_pages":
      return { ok: false, text: "No Facebook Pages were found. When Facebook asks, make sure you select your Page (and its Instagram account)." };
    default:
      return { ok: false, text: `Something went wrong connecting ${name}. Try again.` };
  }
}

export default async function ConnectionsPage({ searchParams }: PageProps<"/connections">) {
  const [accounts, params] = await Promise.all([getSocialAccounts(), searchParams]);
  const message = resultMessage(params);

  return (
    <>
      <PageHeader
        title="Connections"
        description="Connect the accounts you want to post to."
      />

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const connected = accounts.filter((a) => a.platform === platform.id);
          const isConnected = connected.some((a) => a.status === "connected");

          return (
            <Card key={platform.id}>
              <CardContent className="flex h-full flex-col gap-4">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={platform} />
                  <div className="min-w-0">
                    <p className="font-medium">{platform.name}</p>
                    {isConnected ? (
                      <Badge className="mt-1">Connected</Badge>
                    ) : (
                      <Badge variant="outline" className="mt-1">
                        Not connected
                      </Badge>
                    )}
                  </div>
                </div>

                {connected.length > 0 ? (
                  <ul className="space-y-2">
                    {connected.map((a) => {
                      const name = a.display_name ?? a.username ?? platform.name;
                      return (
                        <li key={a.id} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2">
                          {a.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.avatar_url} alt="" className="size-8 rounded-full object-cover" />
                          ) : (
                            <span className="size-8 rounded-full bg-accent" />
                          )}
                          <div className="min-w-0 flex-1 text-sm">
                            <p className="truncate font-medium">{name}</p>
                            {a.username && <p className="truncate text-muted-foreground">@{a.username}</p>}
                            {a.status !== "connected" && (
                              <p className="text-destructive">Needs reconnecting</p>
                            )}
                          </div>
                          <DisconnectButton accountId={a.id} name={name} />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{platform.description}</p>
                )}

                {/* A plain link (not <Link>) because it leaves the site for Google/Facebook. */}
                <a
                  href={`/api/connect/${platform.provider}`}
                  className={buttonVariants({ variant: isConnected ? "outline" : "default", className: "mt-auto w-full" })}
                >
                  {isConnected ? "Connect another" : `Connect ${platform.name}`}
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Facebook and Instagram connect together: one Facebook login adds your Pages and the Instagram
        accounts linked to them.
      </p>
    </>
  );
}
