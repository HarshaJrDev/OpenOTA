// Schema.org JSON-LD — describes what OpenOTA actually is (a free, open-source, self-hostable
// developer tool), not a fabricated pricing/rating claim. SoftwareApplication is the correct type
// for a CLI+SDK+server product like this; Organization anchors the publisher identity for both.
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
      softwareVersion: "0.3.1",
      author: { "@type": "Organization", name: "OpenOTA", url: "https://openota.xyz" },
    },
    {
      "@type": "Organization",
      name: "OpenOTA",
      url: "https://openota.xyz",
      logo: "https://openota.xyz/icon.png",
      sameAs: ["https://github.com/HarshaJrDev/OpenOTA"],
    },
  ],
};

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- static, hand-authored JSON, not user input
      dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
    />
  );
}
