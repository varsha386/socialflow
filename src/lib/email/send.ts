import "server-only";

// Sends an email through Resend (https://resend.com/docs/api-reference/emails/send-email).
// Without RESEND_API_KEY (e.g. on your own computer), the email is printed in the
// dev server window instead, so you can see exactly what would have been sent.

export type Email = { to: string; subject: string; text: string; html: string };

// Until a domain is verified in Resend, only its test address can send,
// and only to the Resend account owner's own email.
const DEFAULT_FROM = "SocialFlow <onboarding@resend.dev>";

// The site's address, for links in emails.
export function siteUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

// Returns true if the email was sent (or printed). Never throws: a failed email
// must not break the publishing or syncing it's reporting on.
export async function sendEmail(email: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      [
        "",
        "──────── [email] not sent: RESEND_API_KEY isn't set. It would have been: ────────",
        `To:      ${email.to}`,
        `Subject: ${email.subject}`,
        "",
        email.text,
        "──────────────────────────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
    if (!res.ok) {
      console.error(`[email] Resend returned ${res.status}:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] couldn't reach Resend:", err);
    return false;
  }
}
