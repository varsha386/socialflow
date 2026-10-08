import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {SITE.name} helps you create, schedule and publish posts to Instagram, Facebook and YouTube. It&apos;s a
        personal learning and portfolio project. This page explains what data it uses and why.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your account details: your name, email address, and time zone.</li>
        <li>
          Connected accounts: when you connect Instagram, Facebook or YouTube, we store the account&apos;s name,
          ID and profile picture, plus the login tokens those services give us.
        </li>
        <li>Content you create: captions, photos and videos you upload, and when posts are scheduled.</li>
        <li>
          Results and analytics: the IDs and links of published posts, their likes, comments, shares and views, your
          follower counts, and comments people leave on your posts.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To publish your posts to the accounts you choose, at the times you choose.</li>
        <li>To show your posts&apos; results and comments, and to send replies you write.</li>
        <li>We don&apos;t sell your data, show you ads, or use it for anything else.</li>
      </ul>

      <h2>How we protect it</h2>
      <ul>
        <li>Login tokens for your social accounts are encrypted before they&apos;re stored.</li>
        <li>Database rules make sure each person can only see their own data.</li>
        <li>
          Data is stored with our service providers: Supabase (database and file storage), Vercel (hosting) and
          Inngest (scheduling).
        </li>
      </ul>

      <h2>Data from Google and Meta</h2>
      <p>
        {SITE.name}&apos;s use of information received from Google APIs follows the Google API Services User Data
        Policy, including its Limited Use requirements. Data from YouTube and Meta (Facebook and Instagram) is used
        only to provide the features described above. You can also remove {SITE.name}&apos;s access at any time
        from your Google account settings or Facebook&apos;s Business Integrations settings.
      </p>

      <h2>Deleting your data</h2>
      <ul>
        <li>Disconnecting an account in Connections deletes its stored login tokens right away.</li>
        <li>Deleting a draft removes it from {SITE.name}.</li>
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
