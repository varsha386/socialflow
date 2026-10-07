import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PlatformBadge } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PLATFORMS } from "@/lib/platforms";

export const metadata: Metadata = { title: "Connections" };

export default function ConnectionsPage() {
  return (
    <>
      <PageHeader
        title="Connections"
        description="Connect the accounts you want to post to."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <Card key={platform.id}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <PlatformBadge platform={platform} />
                <div className="min-w-0">
                  <p className="font-medium">{platform.name}</p>
                  <Badge variant="outline" className="mt-1">
                    Not connected
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{platform.description}</p>
              {/* Connecting is built in Phase 5. */}
              <Button variant="outline" className="w-full">
                Connect {platform.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
