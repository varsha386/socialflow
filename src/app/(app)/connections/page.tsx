import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PlatformBadge } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSocialAccounts } from "@/lib/data";
import { PLATFORMS } from "@/lib/platforms";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage() {
  const accounts = await getSocialAccounts();

  return (
    <>
      <PageHeader
        title="Connections"
        description="Connect the accounts you want to post to."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const connected = accounts.filter(
            (a) => a.platform === platform.id && a.status === "connected"
          );
          const isConnected = connected.length > 0;

          return (
            <Card key={platform.id}>
              <CardContent className="flex flex-col gap-4">
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

                {isConnected ? (
                  <ul className="space-y-1 text-sm">
                    {connected.map((a) => (
                      <li key={a.id} className="truncate">
                        {a.display_name ?? a.username}
                        {a.username && (
                          <span className="text-muted-foreground"> @{a.username}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{platform.description}</p>
                )}

                {/* Connecting is built in Phase 5. */}
                <Button variant="outline" className="w-full">
                  {isConnected ? "Add another account" : `Connect ${platform.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
