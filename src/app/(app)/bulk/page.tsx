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
        description="Many files at once: each photo or video becomes its own separate post, spaced out on a schedule. For one post with several photos (a carousel), use Create post."
      />
      <BulkScheduler
        userId={user.id}
        timezone={user.timezone}
        // Pinterest is left out: each Pin needs a board, chosen on Create post.
        accounts={accounts.filter((a) => a.status === "connected" && a.platform !== "pinterest")}
      />
    </>
  );
}
