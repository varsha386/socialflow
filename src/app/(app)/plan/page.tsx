import type { Metadata } from "next";
import { Check, Crown, Mail, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/data";
import { getPlanInfo, getUsage } from "@/lib/plan-limits";
import { FREE_LIMITS, PRO_PRICE } from "@/lib/plans";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan" };

const FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Connected accounts", free: String(FREE_LIMITS.accounts), pro: "Unlimited" },
  { label: "Scheduled or queued posts", free: `${FREE_LIMITS.scheduledPerMonth} a month`, pro: "Unlimited" },
  { label: "AI captions", free: `${FREE_LIMITS.aiCaptionsPerMonth} a month`, pro: "Unlimited" },
  { label: "Publishing, calendar, queue, inbox", free: true, pro: true },
  { label: "Detailed analytics: best times and top posts", free: false, pro: true },
  { label: "Priority support", free: false, pro: true },
];

// Payments aren't set up yet, so upgrading starts as an email.
const upgradeLink = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent("Upgrade to SocialFlow Pro")}&body=${encodeURIComponent(
  "Hi! I'd like to upgrade my SocialFlow account to Pro."
)}`;

export default async function PlanPage() {
  const user = await getCurrentUser();
  const { plan } = await getPlanInfo(user.id);
  const usage = await getUsage(user.id, user.timezone);
  const pro = plan === "pro";

  const meters = [
    { label: "Connected accounts", used: usage.accounts, limit: FREE_LIMITS.accounts },
    { label: "Scheduled posts this month", used: usage.scheduledThisMonth, limit: FREE_LIMITS.scheduledPerMonth },
    { label: "AI captions this month", used: usage.aiCaptionsThisMonth, limit: FREE_LIMITS.aiCaptionsPerMonth },
  ];

  return (
    <>
      <PageHeader title="Plan" description="What's included, and how much you've used this month." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your plan
              {pro ? (
                <Badge>
                  <Crown /> Pro
                </Badge>
              ) : (
                <Badge variant="outline">Free</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {pro ? "Everything is unlimited. Thank you for supporting SocialFlow!" : "Months reset on the 1st, in your time zone."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {meters.map((m) => {
              const full = !pro && m.used >= m.limit;
              return (
                <div key={m.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{m.label}</span>
                    <span className={cn("tabular-nums", full ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {pro ? `${m.used} · unlimited` : `${m.used} of ${m.limit}`}
                    </span>
                  </div>
                  {!pro && (
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-label={m.label}
                      aria-valuemin={0}
                      aria-valuemax={m.limit}
                      aria-valuenow={Math.min(m.used, m.limit)}
                    >
                      <div
                        className={cn("h-full rounded-full", full ? "bg-destructive" : "bg-primary")}
                        style={{ width: `${Math.min(100, (m.used / m.limit) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {pro && (
              <div className="flex items-start gap-3 rounded-2xl bg-accent p-3 text-sm text-accent-foreground">
                <Mail className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-medium">Priority support:</span> email{" "}
                  <a href={`mailto:${SITE.contactEmail}`} className="font-medium underline">
                    {SITE.contactEmail}
                  </a>{" "}
                  and you&apos;ll hear back first.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-5 py-4 text-left font-medium text-muted-foreground">Compare plans</th>
                  <th className="px-3 py-4 text-center font-medium">
                    Free
                    <span className="block text-xs font-normal text-muted-foreground">$0</span>
                  </th>
                  <th className="bg-accent/50 px-3 py-4 text-center font-medium">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="size-4 text-primary" /> Pro
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">{PRO_PRICE}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {FEATURES.map((f) => (
                  <tr key={f.label}>
                    <td className="px-5 py-3">{f.label}</td>
                    {[f.free, f.pro].map((value, i) => (
                      <td key={i} className={cn("px-3 py-3 text-center", i === 1 && "bg-accent/50")}>
                        {value === true ? (
                          <Check className="mx-auto size-4 text-primary" aria-label="Included" />
                        ) : value === false ? (
                          <X className="mx-auto size-4 text-muted-foreground" aria-label="Not included" />
                        ) : (
                          value
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t px-5 py-4">
            {pro ? (
              <p className="text-sm text-muted-foreground">You&apos;re on Pro.</p>
            ) : (
              <>
                <a href={upgradeLink} className={buttonVariants({ size: "lg" })}>
                  <Crown />
                  Upgrade to Pro
                </a>
                <p className="text-sm text-muted-foreground">
                  Online payment is coming soon. For now, this emails us and we&apos;ll upgrade you.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
