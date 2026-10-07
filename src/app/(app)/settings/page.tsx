import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your profile and preferences." />
      <ComingSoon
        icon={Settings}
        title="Settings are coming in Phase 3"
        text="Update your name, photo, password, and time zone once login is set up."
      />
    </>
  );
}
