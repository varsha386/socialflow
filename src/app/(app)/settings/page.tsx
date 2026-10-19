import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { timeZoneLabel } from "@/lib/timezone";
import { DEFAULT_EMAIL_ALERTS, EMAIL_ALERTS, type EmailAlertSettings } from "@/lib/email/alert-options";
import { AppearanceCard } from "./appearance-card";
import { EmailAlertsCard } from "./email-alerts-card";
import { ProfileForm } from "./profile-form";
import { TwoStepCard } from "./two-step-card";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: factors }, { data: alerts }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.from("profiles").select(EMAIL_ALERTS.map((a) => a.key).join(", ")).eq("id", user.id).maybeSingle(),
  ]);
  const emailAlerts: EmailAlertSettings = { ...DEFAULT_EMAIL_ALERTS, ...(alerts as Partial<EmailAlertSettings> | null) };
  const twoStepOn = (factors?.totp ?? []).some((f) => f.status === "verified");
  // Sorted by the name people see (e.g. Asia/Calcutta is shown and sorted as Asia/Kolkata).
  const known = Intl.supportedValuesOf("timeZone")
    .filter((tz) => tz !== "UTC")
    .sort((a, b) => timeZoneLabel(a).localeCompare(timeZoneLabel(b)));
  // Keep the saved zone in the list even if it's an alias this list doesn't include.
  const timezones = ["UTC", ...(known.includes(user.timezone) || user.timezone === "UTC" ? [] : [user.timezone]), ...known];

  return (
    <>
      <PageHeader title="Settings" description="Your profile and preferences." />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear in SocialFlow.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            name={user.name}
            email={user.email}
            timezone={user.timezone}
            timezones={timezones}
          />
        </CardContent>
      </Card>

      <div className="mt-6">
        <AppearanceCard />
      </div>

      <div className="mt-6">
        <EmailAlertsCard email={user.email} initial={emailAlerts} />
      </div>

      <div className="mt-6">
        <TwoStepCard enabled={twoStepOn} />
      </div>
    </>
  );
}
