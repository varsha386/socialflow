import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

// Every platform SocialFlow connects to, or is adding (platform reviewers check that they're named here).
const PLATFORM_LIST = "Instagram, Facebook, YouTube, Threads, Bluesky, LinkedIn, Pinterest and X (Twitter)";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {SITE.name} helps you create, schedule and publish posts to your social accounts: {PLATFORM_LIST}. It&apos;s
        a personal learning and portfolio project. This page explains what data it uses and why.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your account details: your name, email address, and time zone.</li>
        <li>
          Connected accounts: when you connect one of these accounts, we store the account&apos;s name, username,
          ID and profile picture, plus the login tokens (or, for Bluesky, the app password) that service gives us.
          For Pinterest, we also read the names and IDs of your boards so you can choose where a Pin goes.
        </li>
        <li>Content you create: captions, photos and videos you upload, and when posts are scheduled.</li>
        <li>
          Results and analytics: the IDs and links of published posts, their likes, comments, shares and views, your
          follower counts, and comments people leave on your posts.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>
          To publish your posts to the accounts you choose, at the times you choose, and to delete them there when
          you ask.
        </li>
        <li>To show your posts&apos; results and comments, and to send replies you write.</li>
        <li>We don&apos;t sell your data, show you ads, or use it for anything else.</li>
      </ul>

      <h2>How we protect it</h2>
      <ul>
        <li>Login tokens for your social accounts are encrypted before they&apos;re stored.</li>
        <li>Database rules make sure each person can only see their own data.</li>
        <li>
          Data is stored with our service providers: Supabase (database and file storage), Vercel (hosting) and
          Inngest (scheduling). Resend sends our emails, and Anthropic receives only the text you type into
          &quot;Write with AI&quot;, to suggest captions.
        </li>
      </ul>

      <h2>Data from the platforms</h2>
      <p>
        {SITE.name}&apos;s use of information received from Google APIs follows the Google API Services User Data
        Policy, including its Limited Use requirements. Data from every connected platform ({PLATFORM_LIST}) is
        used only to provide the features described above, is never shared with anyone else, and is never used to
        train AI models. We only act on your accounts when you ask, for example by publishing or scheduling a post.
      </p>
      <p>You can remove {SITE.name}&apos;s access at any time, in Connections or in each service&apos;s own settings:</p>
      <ul>
        <li>Google / YouTube: your Google account&apos;s &quot;Third-party apps and services&quot;.</li>
        <li>Facebook and Instagram: Facebook&apos;s &quot;Business Integrations&quot; settings.</li>
        <li>Threads: Threads&apos; &quot;Website permissions&quot; settings.</li>
        <li>Bluesky: delete the app password in Bluesky&apos;s &quot;App passwords&quot; settings.</li>
        <li>LinkedIn: LinkedIn&apos;s &quot;Permitted services&quot; settings.</li>
        <li>Pinterest: Pinterest&apos;s &quot;Apps&quot; settings, under Security and logins.</li>
        <li>X: X&apos;s &quot;Connected apps&quot; settings.</li>
      </ul>

      <h2>Deleting your data</h2>
      <ul>
        <li>Disconnecting an account in Connections deletes its stored login tokens right away.</li>
        <li>Deleting a post removes it, and its results, from {SITE.name}.</li>
        <li>
          To delete your whole {SITE.name} account and everything in it, email{" "}
          <a href={`mailto:${SITE.contactEmail}`} className="text-primary hover:underline">
            {SITE.contactEmail}
          </a>{" "}
          from your account&apos;s email address. We&apos;ll delete it within 30 days.
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href={`mailto:${SITE.contactEmail}`} className="text-primary hover:underline">
          {SITE.contactEmail}
        </a>
        .
      </p>
    </LegalPage>
  );
}
