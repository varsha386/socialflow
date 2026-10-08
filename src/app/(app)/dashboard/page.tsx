import type { Metadata } from "next";
import Link from "next/link";
import { Check, CalendarClock, CircleCheck, Plug, SquarePen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getDashboardStats } from "@/lib/data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [user, stats] = await Promise.all([getCurrentUser(), getDashboardStats()]);
  const firstName = user.name.split(" ")[0];

  const cards = [
    { label: "Scheduled posts", value: stats.scheduledPosts, icon: CalendarClock },
    { label: "Published this week", value: stats.publishedThisWeek, icon: CircleCheck },
    { label: "Connected accounts", value: stats.connectedAccounts, icon: Plug },
  ];

  return (
    <>
      <PageHeader title={`Hi, ${firstName}`} description="Your posting activity at a glance.">
        <Link href="/create" className={buttonVariants({ size: "lg" })}>
          <SquarePen />
          Create post
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {stat.label}
              </CardTitle>
              <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Get started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Step n={1} done={stats.connectedAccounts > 0}>
            <Link href="/connections" className="text-primary hover:underline">
              Connect your social accounts
            </Link>
          </Step>
          <Step n={2} done={stats.totalPosts > 0}>
            <Link href="/create" className="text-primary hover:underline">
              Create your first post
            </Link>
          </Step>
          <Step n={3} done={stats.scheduledPosts > 0}>
            <Link href="/calendar" className="text-primary hover:underline">
              Plan your week in the calendar
            </Link>
          </Step>
        </CardContent>
      </Card>
    </>
  );
}

function Step({
  n,
  done,
  children,
}: {
  n: number;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={
          done
            ? "flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
            : "flex size-6 items-center justify-center rounded-full border text-xs text-muted-foreground"
        }
      >
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <span>{children}</span>
    </div>
  );
}
