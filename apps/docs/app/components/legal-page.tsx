import { BreadcrumbJsonLd } from "./breadcrumb-jsonld";
import { FadeIn } from "./fade-in";
import { SiteFooter, SiteNav } from "./site-nav";

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  path: string;
  children: React.ReactNode;
}

/** Shared shell for every legal/informational page — one place to keep them visually consistent. */
export function LegalPage({ title, lastUpdated, path, children }: LegalPageProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <BreadcrumbJsonLd items={[{ name: title, path }]} />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] grid-fade" />
      <SiteNav stars={null} />

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-20">
        <FadeIn>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated {lastUpdated}</p>
        </FadeIn>

        <FadeIn delay={0.08} className="prose prose-invert mt-12 max-w-none">
          <div className="space-y-10 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:tracking-tight [&_a]:text-brand-from [&_a]:underline [&_a]:underline-offset-4">
            {children}
          </div>
        </FadeIn>
      </section>

      <SiteFooter />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2>{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}
