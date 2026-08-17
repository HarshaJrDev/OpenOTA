const SITE_URL = "https://openota.xyz";

/** One reusable BreadcrumbList emitter for every non-homepage route — the homepage's own
 * single-item breadcrumb lives in structured-data.tsx since it's tied into that page's larger
 * @graph. `items` excludes Home; it's always prepended here so every page only has to name its
 * own path segment(s). */
export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  const itemListElement = [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    ...items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 2,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  ];

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };

  return (
    <script
      type="application/ld+json"
      // Static, hand-built from route names below — never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
