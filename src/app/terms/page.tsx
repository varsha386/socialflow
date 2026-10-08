import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        By using {SITE.name}, you agree to these terms. {SITE.name} is a personal learning and portfolio project,
        offered free of charge and as is.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Keep your login details safe. You&apos;re responsible for what happens in your account.</li>
        <li>Only connect social media accounts you own or are allowed to manage.</li>
      </ul>

      <h2>Your content</h2>
      <ul>
        <li>You own what you post. You give {SITE.name} permission to store it and send it to the accounts you choose.</li>
        <li>
          You&apos;re responsible for your content, and it must follow the rules of Instagram, Facebook and YouTube.
          Don&apos;t use {SITE.name} for spam or anything illegal.
        </li>
      </ul>

      <h2>No guarantees</h2>
      <ul>
        <li>
          Posts depend on Instagram, Facebook and YouTube, which can change, limit or reject them. We can&apos;t
          promise every post will publish, or publish at exactly the scheduled time.
        </li>
        <li>The service may change, pause or end at any time. Keep your own copies of anything important.</li>
        <li>As far as the law allows, {SITE.name} isn&apos;t liable for losses from using it.</li>
      </ul>

      <h2>Ending</h2>
      <p>
        You can stop using {SITE.name} at any time. See the{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>{" "}
        for how to delete your data. We may close accounts that break these terms.
      </p>

      <h2>Contact</h2>
      <p>
        Email{" "}
        <a href={`mailto:${SITE.contactEmail}`} className="text-primary hover:underline">
          {SITE.contactEmail}
        </a>
        .
      </p>
    </LegalPage>
  );
}
