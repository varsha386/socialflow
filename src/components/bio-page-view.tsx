import { ExternalLink } from "lucide-react";
import type { BioLink } from "@/lib/bio";

// The public link-in-bio page: shown at /u/<handle>, and as the live preview in the editor.
export function BioPageView({
  title,
  bio,
  avatarUrl,
  links,
}: {
  title: string;
  bio: string;
  avatarUrl: string | null;
  links: BioLink[];
}) {
  const initials =
    title
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-10 text-center">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="size-24 rounded-full object-cover ring-4 ring-card" />
      ) : (
        <span className="flex size-24 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground ring-4 ring-card">
          {initials}
        </span>
      )}
      <h1 className="mt-4 text-2xl font-semibold tracking-tight break-words">{title || "Your name"}</h1>
      {bio && <p className="mt-2 text-muted-foreground break-words whitespace-pre-line">{bio}</p>}

      <ul className="mt-8 w-full space-y-3">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-card px-5 py-3 font-medium shadow-sm ring-1 ring-border transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span className="min-w-0 break-words">{link.title}</span>
              <ExternalLink className="size-4 shrink-0 opacity-60" />
            </a>
          </li>
        ))}
      </ul>
      {links.length === 0 && <p className="mt-8 text-sm text-muted-foreground">No links yet.</p>}
    </div>
  );
}
