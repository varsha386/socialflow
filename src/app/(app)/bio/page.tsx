import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { suggestHandle } from "@/lib/bio";
import { getCurrentUser, getMyBioPage } from "@/lib/data";
import { BioEditor } from "./bio-editor";

export const metadata: Metadata = { title: "Link in bio" };

export default async function BioPage() {
  const [user, { page, links, avatarUrl }] = await Promise.all([getCurrentUser(), getMyBioPage()]);

  return (
    <>
      <PageHeader
        title="Link in bio"
        description="One page with all your links. Put its address in your Instagram, Facebook or YouTube bio."
      />
      <BioEditor
        // Start a new page with the person's name, hidden until they choose to publish.
        initial={page ?? { handle: suggestHandle(user.name, user.email), title: user.name, bio: "", published: false }}
        saved={page !== null}
        links={links}
        avatarUrl={avatarUrl}
      />
    </>
  );
}
