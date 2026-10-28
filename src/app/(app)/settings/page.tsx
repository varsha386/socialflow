import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Palette, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/data";
import { DEFAULT_EMAIL_ALERTS, EMAIL_ALERTS, type EmailAlertSettings } from "@/lib/email/alert-options";
import { createClient } from "@/lib/supabase/server";
import { timeZoneLabel } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { AppearanceCard } from "./appearance-card";
import { EmailAlertsCard } from "./email-alerts-card";
import { ProfileForm } from "./profile-form";
import { TwoStepCard } from "./two-step-card";

export const metadata: Metadata = { title: "Settings" };

// One section shows at a time; ?tab=... in the address remembers which,
// so links (e.g. from emails) can open the right one.
const TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { tab: requested } = await searchParams;
  const tab: TabId = TABS.find((t) => t.id === requested)?.id ?? "profile";
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader title="Settings" description="Your profile and preferences." />

      {/* A 2 × 2 grid on phones (no sideways scrolling), one row on bigger screens. */}
      <nav aria-label="Settings sections" className="mb-6 grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={id === "profile" ? "/settings" : `/settings?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-colors sm:justify-start",
              tab === id
                ? "bg-primary font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      {tab === "profile" && <ProfileSection user={user} />}
      {tab === "appearance" && <AppearanceCard />}
      {tab === "notifications" && <NotificationsSection userId={user.id} email={user.email} />}
      {tab === "security" && <SecuritySection />}
    </>
  );
}

function ProfileSection({ user }: { user: Awaited<ReturnType<typeof getCurrentUser>> }) {
  // Sorted by the name people see (e.g. Asia/Calcutta is shown and sorted as Asia/Kolkata).
  const known = Intl.supportedValuesOf("timeZone")
    .filter((tz) => tz !== "UTC")
    .sort((a, b) => timeZoneLabel(a).localeCompare(timeZoneLabel(b)));
  // Keep the saved zone in the list even if it's an alias this list doesn't include.
  const timezones = ["UTC", ...(known.includes(user.timezone) || user.timezone === "UTC" ? [] : [user.timezone]), ...known];

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear in Ripple.</CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm name={user.name} email={user.email} timezone={user.timezone} timezones={timezones} />
      </CardContent>
    </Card>
  );
}

async function NotificationsSection({ userId, email }: { userId: string; email: string }) {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("profiles")
    .select(EMAIL_ALERTS.map((a) => a.key).join(", "))
    .eq("id", userId)
    .maybeSingle();
  const emailAlerts: EmailAlertSettings = { ...DEFAULT_EMAIL_ALERTS, ...(alerts as Partial<EmailAlertSettings> | null) };
  return <EmailAlertsCard email={email} initial={emailAlerts} />;
}

async function SecuritySection() {
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const twoStepOn = (factors?.totp ?? []).some((f) => f.status === "verified");
  return <TwoStepCard enabled={twoStepOn} />;
}
