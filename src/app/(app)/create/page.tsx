import type { Metadata } from "next";
import { SquarePen } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Create post" };

export default function CreatePostPage() {
  return (
    <>
      <PageHeader
        title="Create post"
        description="Write once, then publish or schedule it everywhere."
      />
      <ComingSoon
        icon={SquarePen}
        title="The post editor is coming in Phase 6"
        text="Upload media, write captions for each platform, preview, then publish or schedule."
      />
    </>
  );
}
