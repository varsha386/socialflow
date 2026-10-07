import type { Metadata } from "next";
import { ChartColumn } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Analytics" description="How your posts are performing." />
      <ComingSoon
        icon={ChartColumn}
        title="Analytics are coming in Phase 11"
        text="Views, likes, comments, and follower growth across all your accounts."
      />
    </>
  );
}
