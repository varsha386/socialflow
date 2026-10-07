import type { Metadata } from "next";
import { List } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Posts" };

export default function PostsPage() {
  return (
    <>
      <PageHeader title="Posts" description="Drafts, scheduled, and published posts." />
      <ComingSoon
        icon={List}
        title="Your posts will show up here"
        text="Track the status of every post on every platform, and retry any that fail."
      />
    </>
  );
}
