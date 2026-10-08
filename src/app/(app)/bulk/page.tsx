import type { Metadata } from "next";
import { BulkScheduler } from "@/components/bulk/bulk-scheduler";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser, getSocialAccounts } from "@/lib/data";

export const metadata: Metadata = { title: "Bulk upload" };

export default async function BulkPage() {
  const [user, accounts] = await Promise.all([getCurrentUser(), getSocialAccounts()]);

  return (
    <>
      <PageHeader
        title="Bulk upload"
        description="Upload many photos and videos, and schedule them as separate posts."
      />
      <BulkScheduler
        userId={user.id}
        timezone={user.timezone}
        accounts={accounts.filter((a) => a.status === "connected")}
      />
    </>
  );
}
