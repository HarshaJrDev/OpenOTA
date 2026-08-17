import type { Metadata } from "next";

import { LegalPage, Section } from "../components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using openota.xyz and OpenOTA Cloud.",
};

const CONTACT_EMAIL = "developmet1043@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="August 2026" path="/terms">
      <Section title="The software itself">
        <p>
          OpenOTA — the CLI, SDK, native modules, and server — is open source under the MIT license. You can read,
          fork, modify, and self-host it without restriction, subject only to the MIT license terms in the{" "}
          <a href="https://github.com/HarshaJrDev/OpenOTA" target="_blank" rel="noopener noreferrer">
            GitHub repository
          </a>
          .
        </p>
      </Section>

      <Section title="Using OpenOTA Cloud">
        <p>
          OpenOTA Cloud is the hosted version of the same open-source server. By creating an account you agree to:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide accurate account information and keep your credentials/API keys secure.</li>
          <li>Use it to distribute OTA updates for apps you own or are authorized to update.</li>
          <li>Not attempt to abuse, overload, or reverse-engineer the service in bad faith.</li>
        </ul>
      </Section>

      <Section title="No uptime guarantee (yet)">
        <p>
          OpenOTA Cloud is provided as-is, without a formal SLA at this stage. If uptime is critical to your
          release process, self-hosting gives you full control over that — the server code is identical either
          way.
        </p>
      </Section>

      <Section title="Your content, your responsibility">
        <p>
          You&apos;re responsible for what you publish through OpenOTA — the JS bundles, release notes, and
          configuration you upload. OpenOTA verifies checksums and runtime compatibility; it does not review the
          content of what you release.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          These terms may be updated as the product evolves. Meaningful changes will be reflected here with an
          updated date at the top of this page.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
