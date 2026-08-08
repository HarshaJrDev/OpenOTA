import type { Metadata } from "next";

import { LegalPage, Section } from "../components/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "What cookies openota.xyz and the OpenOTA dashboard use.",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="August 2026">
      <Section title="This marketing site">
        <p>
          openota.xyz itself sets no cookies of its own. If the site operator has enabled Google Analytics 4 or
          Microsoft Clarity (both optional, off by default — see the{" "}
          <a href="/privacy">Privacy Policy</a>), those services set their own standard analytics cookies to
          distinguish visitors across a session.
        </p>
      </Section>

      <Section title="The OpenOTA dashboard">
        <p>
          Signing into the OpenOTA Cloud dashboard sets one cookie: a session cookie that keeps you logged in. It&apos;s
          strictly functional — it exists to authenticate your requests, not to track you across other sites. It
          expires when your session ends or you sign out.
        </p>
      </Section>

      <Section title="No third-party advertising cookies">
        <p>This site does not currently run any advertising, and sets no advertising or cross-site tracking cookies.</p>
      </Section>

      <Section title="Controlling cookies">
        <p>
          You can block or delete cookies in your browser settings at any time. Blocking the dashboard&apos;s
          session cookie will simply sign you out — it has no other effect.
        </p>
      </Section>
    </LegalPage>
  );
}
