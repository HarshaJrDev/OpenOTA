// Schema.org JSON-LD — describes what OpenOTA actually is (a free, open-source, self-hostable
// developer tool), not a fabricated pricing/rating claim. SoftwareApplication is the correct type
// for a CLI+SDK+server product like this; Organization anchors the publisher identity for both.
// WebPage ties the homepage's content to that same author/publisher for AI/answer-engine
// extraction, with a real, honest date — the SDK's actual last-shipped version, not a fabricated
// "last updated today" claim (see packages/sdk/package.json for the source of truth).
const LAST_UPDATED = "2026-08-09";

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "OpenOTA",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Android, iOS",
      description:
        "Ship JavaScript bundle updates to a React Native app over the air — instantly, checksum-verified on-device, and reversible without a re-deploy. Self-hosted or OpenOTA Cloud, MIT licensed.",
      url: "https://openota.xyz",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free and open source under the MIT license; self-host at no cost.",
      },
      softwareVersion: "0.4.0",
      dateModified: LAST_UPDATED,
      author: { "@type": "Organization", name: "OpenOTA", url: "https://openota.xyz" },
    },
    {
      "@type": "Organization",
      name: "OpenOTA",
      url: "https://openota.xyz",
      logo: "https://openota.xyz/icon.png",
      sameAs: ["https://github.com/HarshaJrDev/OpenOTA"],
    },
    {
      "@type": "WebPage",
      "@id": "https://openota.xyz/#webpage",
      url: "https://openota.xyz",
      name: "OpenOTA — Open Source OTA Platform for React Native",
      description:
        "Push React Native app updates instantly — no App Store wait, no review queue. Self-hosted or Cloud, checksum-verified on-device, instant one-tap rollback.",
      datePublished: "2026-08-08",
      dateModified: LAST_UPDATED,
      isPartOf: { "@type": "WebSite", name: "OpenOTA", url: "https://openota.xyz" },
      author: { "@type": "Organization", name: "OpenOTA", url: "https://openota.xyz" },
      publisher: { "@type": "Organization", name: "OpenOTA", url: "https://openota.xyz" },
      breadcrumb: { "@id": "https://openota.xyz/#breadcrumb" },
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://openota.xyz/#breadcrumb",
      itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://openota.xyz" }],
    },
  ],
};

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      // Static, hand-authored JSON below — never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
    />
  );
}
