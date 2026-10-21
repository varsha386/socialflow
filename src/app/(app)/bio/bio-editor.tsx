"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, CircleCheck, Copy, ExternalLink, LoaderCircle, Plus, Trash } from "lucide-react";
import { BioPageView } from "@/components/bio-page-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BIO_LIMITS, bioPath, type BioLink, type BioPage } from "@/lib/bio";
import { cn } from "@/lib/utils";
import { addBioLink, deleteBioLink, moveBioLink, saveBioPage } from "./actions";

const noSubscribe = () => () => {};

export function BioEditor({
  initial,
  saved,
  links,
  avatarUrl,
}: {
  initial: BioPage;
  saved: boolean; // false until the page is saved for the first time
  links: BioLink[];
  avatarUrl: string | null;
}) {
  const [page, setPage] = useState(initial);
  const [savedHandle, setSavedHandle] = useState(saved ? initial.handle : null);
  const [savedPublished, setSavedPublished] = useState(saved && initial.published);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  // The site's address (e.g. https://socialflow-uhru.vercel.app), only known in the browser.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const publicUrl = savedHandle ? `${origin}${bioPath(savedHandle)}` : null;

  const change = (patch: Partial<BioPage>) => {
    setMessage(null);
    setDirty(true);
    setPage((p) => ({ ...p, ...patch }));
  };

  function save(next: BioPage = page) {
    startSaving(async () => {
      const result = await saveBioPage(next);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      const handle = next.handle.trim().toLowerCase();
      setPage({ ...next, handle });
      setSavedHandle(handle);
      setSavedPublished(next.published);
      setDirty(false);
      setMessage({ ok: true, text: next.published ? "Saved. Your page is live." : "Saved. Your page is hidden." });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        {/* 1. Page details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your page
              {savedHandle &&
                (savedPublished ? <Badge>Live</Badge> : <Badge variant="outline">Hidden</Badge>)}
            </CardTitle>
            <CardDescription>
              {publicUrl && savedPublished ? "Anyone with the address can see it." : "Only you can see it until you publish it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="bio-handle">Page name</Label>
              <div className="flex items-center rounded-lg border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="pl-3 text-sm text-muted-foreground">{origin.replace(/^https?:\/\//, "")}/u/</span>
                <input
                  id="bio-handle"
                  value={page.handle}
                  onChange={(e) => change({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                  maxLength={30}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">3–30 lowercase letters, numbers or underscores.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio-title">Title</Label>
              <Input
                id="bio-title"
                value={page.title}
                onChange={(e) => change({ title: e.target.value })}
                maxLength={BIO_LIMITS.title}
                placeholder="Your name or brand"
                className="h-11 bg-card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio-text">Bio</Label>
              <textarea
                id="bio-text"
                value={page.bio}
                onChange={(e) => change({ bio: e.target.value })}
                maxLength={BIO_LIMITS.bio}
                rows={3}
                placeholder="A line or two about you"
                className="w-full resize-none rounded-lg border border-input bg-card px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {page.bio.length}/{BIO_LIMITS.bio}
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl bg-muted p-3 text-sm">
              <input
                type="checkbox"
                checked={page.published}
                onChange={(e) => change({ published: e.target.checked })}
                className="mt-0.5 size-4 accent-(--primary)"
              />
              <span>
                <span className="font-medium">Publish my page</span>
                <span className="block text-muted-foreground">Turn off to hide it without deleting anything.</span>
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-11 px-6" onClick={() => save()} disabled={saving}>
                {saving && <LoaderCircle className="animate-spin" />}
                Save
              </Button>
              {message && (
                <span className={cn("flex items-center gap-1.5 text-sm", message.ok ? "text-muted-foreground" : "text-destructive")}>
                  {message.ok && <CircleCheck className="size-4 text-primary" />}
                  {message.text}
                </span>
              )}
              {dirty && !message && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
            </div>

            {publicUrl && savedPublished && <ShareRow url={publicUrl} />}
          </CardContent>
        </Card>

        {/* 2. Links */}
        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
            <CardDescription>Shown as buttons, in this order. Changes are saved straight away.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {links.length > 0 && (
              <ul className="space-y-2">
                {links.map((link, i) => (
                  <LinkRow key={link.id} link={link} first={i === 0} last={i === links.length - 1} />
                ))}
              </ul>
            )}
            <AddLinkForm full={links.length >= BIO_LIMITS.links} hasLinks={links.length > 0} />
          </CardContent>
        </Card>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-3 text-sm font-medium">Preview</p>
        <div className="overflow-hidden rounded-3xl bg-background ring-1 ring-border">
          <BioPageView title={page.title} bio={page.bio} avatarUrl={avatarUrl} links={links} />
        </div>
      </div>
    </div>
  );
}

// The public address, with Copy and Open buttons.
function ShareRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed p-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{url}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copy your page address:", url);
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[0.8rem] font-medium text-primary hover:underline"
      >
        Open <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

function LinkRow({ link, first, last }: { link: BioLink; first: boolean; last: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => setError((await action()).error ?? null));

  const iconButton =
    "flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:invisible";

  return (
    <li className={cn("rounded-2xl bg-muted px-3 py-2", pending && "opacity-60")}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{link.title}</p>
          <p className="truncate text-xs text-muted-foreground">{link.url}</p>
        </div>
        <button type="button" className={iconButton} disabled={first || pending} onClick={() => run(() => moveBioLink(link.id, "up"))} aria-label={`Move ${link.title} up`} title="Move up">
          <ArrowUp className="size-4" />
        </button>
        <button type="button" className={iconButton} disabled={last || pending} onClick={() => run(() => moveBioLink(link.id, "down"))} aria-label={`Move ${link.title} down`} title="Move down">
          <ArrowDown className="size-4" />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Remove “${link.title}”?`)) run(() => deleteBioLink(link.id));
          }}
          aria-label={`Remove ${link.title}`}
          title="Remove"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash className="size-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </li>
  );
}

function AddLinkForm({ full, hasLinks }: { full: boolean; hasLinks: boolean }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (full) return <p className="text-sm text-muted-foreground">You&apos;ve reached the limit of {BIO_LIMITS.links} links.</p>;

  return (
    <form
      className={cn("space-y-3", hasLinks && "border-t pt-5")}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await addBioLink(title, url);
          if (result.error) {
            setError(result.error);
            return;
          }
          setTitle("");
          setUrl("");
          setError(null);
        });
      }}
    >
      <p className="text-sm font-medium">{hasLinks ? "Add another link" : "Add your first link"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="link-title">Title</Label>
          <Input
            id="link-title"
            value={title}
            onChange={(e) => {
              setError(null);
              setTitle(e.target.value);
            }}
            maxLength={BIO_LIMITS.linkTitle}
            placeholder="My latest video"
            className="h-11 bg-card"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="link-url">Web address</Label>
          <Input
            id="link-url"
            value={url}
            onChange={(e) => {
              setError(null);
              setUrl(e.target.value);
            }}
            inputMode="url"
            autoComplete="url"
            placeholder="youtube.com/watch?v=…"
            className="h-11 bg-card"
          />
        </div>
      </div>
      <Button type="submit" size="lg" variant="outline" className="h-11 px-5" disabled={pending || !title.trim() || !url.trim()}>
        {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
        Add link
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
