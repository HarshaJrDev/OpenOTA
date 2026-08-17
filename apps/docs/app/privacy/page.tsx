import type { Metadata } from "next";

import { LegalPage, Section } from "../components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What data openota.xyz and OpenOTA Cloud collect, and what they don't.",
};

const CONTACT_EMAIL = "developmet1043@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="August 2026" path="/privacy">
      <Section title="Scope">
        <p>
          This policy covers two separate things: the marketing/documentation website you&apos;re reading right
          now (openota.xyz), and OpenOTA Cloud (api.openota.xyz and the dashboard), the hosted version of the
          open-source OpenOTA server. If you self-host OpenOTA instead, none of the Cloud section below applies —
          your server, your data, your policy to write.
        </p>
      </Section>

      <Section title="What this website collects">
        <p>
          Analytics (Google Analytics 4 and Microsoft Clarity) run only if the site operator has configured
          them — both are entirely optional integrations gated behind environment variables. When enabled, they
          collect standard, anonymized usage data (pages visited, approximate location from IP, device/browser
          type) the same way most websites do. This site does not run its own first-party tracking beyond that.
        </p>
      </Section>

      <Section title="What OpenOTA Cloud collects">
        <p>The dashboard and API store exactly what&apos;s needed to run the service:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your account email and a salted, hashed password (scrypt) — never the plaintext password.</li>
          <li>Projects you create, and their release history (bundle versions, checksums, timestamps).</li>
          <li>
            API keys you generate — shown once at creation, stored server-side only as a hash, never in
            recoverable form.
          </li>
          <li>
            Anonymous device check-ins for projects you own (a generated device ID, platform, app version, and
            runtime version) — used to power the &quot;devices on this version&quot; counts in the dashboard, not
            tied to any personal identity.
          </li>
        </ul>
      </Section>

      <Section title="What OpenOTA Cloud does not do">
        <ul className="list-disc space-y-1 pl-5">
          <li>Read the contents of your app&apos;s JS bundles beyond what&apos;s needed to verify and serve them.</li>
          <li>Sell or share your data with third parties.</li>
          <li>Track end users of your app beyond the anonymous device check-in described above.</li>
        </ul>
      </Section>

      <Section title="Your control">
        <p>
          Delete a project from the dashboard and its releases, API keys, and device check-in history are removed.
          Delete your account and everything tied to it goes with it. Because OpenOTA is open source, you can also
          verify all of this directly by reading the server code, or move to self-hosting at any time — same API,
          your own infrastructure.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for anything not covered here, including
          data deletion requests.
        </p>
      </Section>
    </LegalPage>
  );
}
