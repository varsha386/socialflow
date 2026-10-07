import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" description="See everything you've scheduled." />
      <ComingSoon
        icon={CalendarDays}
        title="The calendar is coming in Phase 9"
        text="Monthly and weekly views of your scheduled and published posts."
      />
    </>
  );
}
