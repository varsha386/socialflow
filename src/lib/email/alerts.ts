import "server-only";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import type { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, siteUrl } from "./send";

// The emails SocialFlow sends about things that happen while you're not watching.
// Each one checks the user's choices in Settings (profiles.email_on_*).

type Admin = ReturnType<typeof createAdminClient>;
type Preference = "email_on_failed" | "email_on_reconnect" | "email_on_published";

const platformName = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

// Captions and account names come from users and platforms, so never put them into HTML unescaped.
const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const shorten = (text: string, max = 80) => {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine || "(no caption)";
};

// The user's email address, if they want this kind of email.
async function recipient(admin: Admin, userId: string, preference: Preference): Promise<string | null> {
  const { data: profile } = await admin.from("profiles").select(preference).eq("id", userId).maybeSingle();
  // Before the migration runs, the column doesn't exist: treat that as "use the default".
  const wants = profile && preference in profile ? Boolean((profile as Record<string, unknown>)[preference]) : preference !== "email_on_published";
  if (!wants) return null;
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

// A simple email layout: heading, paragraphs, an optional list and a button.
function layout(opts: { heading: string; intro: string; items?: string[]; button?: { label: string; url: string } }) {
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#3a2a20">
  <p style="font-weight:bold;color:#e0623a;margin:0 0 16px">SocialFlow</p>
  <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(opts.heading)}</h1>
  <p style="margin:0 0 12px;line-height:1.5">${escapeHtml(opts.intro)}</p>
  ${opts.items?.length ? `<ul style="padding-left:20px;line-height:1.6">${opts.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""}
  ${opts.button ? `<p style="margin:20px 0"><a href="${escapeHtml(opts.button.url)}" style="background:#e0623a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;display:inline-block">${escapeHtml(opts.button.label)}</a></p>` : ""}
  <p style="font-size:12px;color:#8a7a70;margin-top:24px"><a href="${escapeHtml(`${siteUrl()}/settings?tab=notifications`)}" style="color:#8a7a70">Turn these emails off</a> in SocialFlow under Settings &gt; Notifications.</p>
</div>`;
  const text = [
    opts.heading,
    "",
    opts.intro,
    ...(opts.items?.length ? ["", ...opts.items.map((i) => `- ${i}`)] : []),
    ...(opts.button ? ["", `${opts.button.label}: ${opts.button.url}`] : []),
    "",
    `Turn these emails off in SocialFlow under Settings > Notifications: ${siteUrl()}/settings?tab=notifications`,
  ].join("\n");
  return { html, text };
}

// After a scheduled post is published: a "failed" email if any account failed,
// or a "went out" email if everything worked (only if the user turned that on).
export async function emailScheduledPostResult(admin: Admin, postId: string, userId: string) {
  const { data } = await admin
    .from("posts")
    .select(
      "caption, status, post_targets ( status, external_url, error_message, social_accounts ( platform, display_name, username ) )"
    )
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { skipped: "post not found" };

  type Target = {
    status: string;
    external_url: string | null;
    error_message: string | null;
    social_accounts: { platform: PlatformId; display_name: string | null; username: string | null } | null;
  };
  const post = data as unknown as { caption: string; status: string; post_targets: Target[] };
  const accountName = (t: Target) =>
    `${t.social_accounts?.display_name ?? t.social_accounts?.username ?? "An account"} (${platformName(t.social_accounts?.platform ?? "facebook")})`;
  const caption = shorten(post.caption);
  const postUrl = `${siteUrl()}/posts/${postId}`;

  if (post.status === "failed" || post.status === "partially_published") {
    const to = await recipient(admin, userId, "email_on_failed");
    if (!to) return { skipped: "turned off" };
    const failed = post.post_targets.filter((t) => t.status === "failed");
    const partly = post.status === "partially_published";
    const { html, text } = layout({
      heading: partly ? "Your scheduled post only partly went out" : "Your scheduled post didn't go out",
      intro: `“${caption}” couldn't be published to ${failed.length === 1 ? "this account" : "these accounts"}:`,
      items: failed.map((t) => `${accountName(t)}: ${t.error_message ?? "Something went wrong."}`),
      button: { label: "Open the post to retry", url: postUrl },
    });
    await sendEmail({ to, subject: partly ? "A scheduled post partly failed" : "A scheduled post failed", text, html });
    return { sent: "failed" };
  }

  if (post.status === "published") {
    const to = await recipient(admin, userId, "email_on_published");
    if (!to) return { skipped: "turned off" };
    const { html, text } = layout({
      heading: "Your scheduled post went out",
      intro: `“${caption}” is now live on:`,
      items: post.post_targets.map((t) => (t.external_url ? `${accountName(t)}: ${t.external_url}` : accountName(t))),
      button: { label: "See it in SocialFlow", url: postUrl },
    });
    await sendEmail({ to, subject: "Your scheduled post went out", text, html });
    return { sent: "published" };
  }

  return { skipped: `status is ${post.status}` };
}

// Marks an account as needing to be reconnected, and emails its owner, but only
// the first time (when it goes from connected to expired), so they get one email, not one every sync.
export async function markNeedsReconnecting(admin: Admin, accountId: string) {
  const { data: account } = await admin
    .from("social_accounts")
    .update({ status: "expired" })
    .eq("id", accountId)
    .eq("status", "connected")
    .select("user_id, platform, display_name, username")
    .maybeSingle();
  if (!account) return; // already marked, or gone

  try {
    const to = await recipient(admin, account.user_id as string, "email_on_reconnect");
    if (!to) return;
    const name = `${account.display_name ?? account.username ?? "One of your accounts"} (${platformName(account.platform as PlatformId)})`;
    const { html, text } = layout({
      heading: "An account needs reconnecting",
      intro: `${name} stopped accepting SocialFlow's login, so posts to it will fail until you reconnect it. This usually happens after a password change or when access was removed.`,
      button: { label: "Reconnect it", url: `${siteUrl()}/connections` },
    });
    await sendEmail({ to, subject: `Reconnect ${name} in SocialFlow`, text, html });
  } catch (err) {
    // The account is marked either way; a missed email mustn't break the sync that found the problem.
    console.error("[email] reconnect alert failed:", err);
  }
}
