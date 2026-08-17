import type { Metadata } from "next";

import { LegalPage, Section } from "../components/legal-page";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "What OpenOTA does and does not guarantee.",
};

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" lastUpdated="August 2026" path="/disclaimer">
      <Section title="Open-source software, provided as-is">
        <p>
          OpenOTA is provided under the MIT license &quot;as is&quot;, without warranty of any kind. See the full
          license text in the{" "}
          <a href="https://github.com/HarshaJrDev/OpenOTA/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
            GitHub repository
          </a>{" "}
          for the exact legal terms.
        </p>
      </Section>

      <Section title="OTA updates have a real boundary">
        <p>
          OpenOTA ships JavaScript and asset changes over the air. It cannot and does not update compiled native
          code, native permissions, or anything that requires a new binary — those changes still need a normal App
          Store / Play Store submission and review. Any release that changes native code requires a matching{" "}
          <code>runtimeVersion</code> bump so incompatible bundles are rejected on-device, not silently installed.
        </p>
      </Section>

      <Section title="Self-hosting is your infrastructure">
        <p>
          If you self-host OpenOTA, you&apos;re responsible for your own server uptime, storage, backups, and
          security configuration. OpenOTA provides the software; it doesn&apos;t operate your deployment for you
          unless you&apos;re using OpenOTA Cloud.
        </p>
      </Section>

      <Section title="No guarantee of fitness for a specific purpose">
        <p>
          As with any software, test your release pipeline (including rollback) in a staging environment before
          relying on it for production releases that matter.
        </p>
      </Section>
    </LegalPage>
  );
}
