import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BioPageView } from "@/components/bio-page-view";
import { HANDLE_PATTERN } from "@/lib/bio";
import { getPublicBioPage } from "@/lib/data";

type Props = { params: Promise<{ handle: string }> };

// Unpublished pages and unknown names both show the normal "not found" page,
// so nobody can tell whether a hidden page exists.
async function load(params: Props["params"]) {
  const { handle } = await params;
  const name = handle.toLowerCase();
  return HANDLE_PATTERN.test(name) ? getPublicBioPage(name) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load(params);
  if (!page) return { title: "Page not found" };
  return {
    // `absolute` skips the "· SocialFlow" ending: this is the person's own page.
    title: { absolute: page.title || "Links" },
    description: page.bio || undefined,
  };
}

export default async function PublicBioPage({ params }: Props) {
  const page = await load(params);
  if (!page) notFound();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <main className="flex-1">
        <BioPageView title={page.title} bio={page.bio} avatarUrl={page.avatarUrl} links={page.links} />
      </main>
      <footer className="pb-8 text-center text-xs text-muted-foreground">
        Made with{" "}
        <Link href="/" className="font-medium hover:text-foreground">
          SocialFlow
        </Link>
      </footer>
    </div>
  );
}
