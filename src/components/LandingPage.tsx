import Link from 'next/link';
import SaddleCard from './SaddleCard';
import type { Listing } from '@/lib/types';
import { SITE_URL } from '@/lib/seo';

/**
 * Shared layout for SEO landing pages (/disciplines/..., /brands/...): an answer-first heading and
 * intro, the matching live saddles, related links, and schema.org data (breadcrumbs + item list)
 * so search engines and AI tools understand the page.
 */
export default function LandingPage({
  heading,
  intro,
  path,
  breadcrumb,
  listings,
  searchHref,
  related,
  relatedTitle
}: {
  heading: string;
  intro: string;
  path: string;
  breadcrumb: string;
  listings: Listing[];
  searchHref: string;
  related?: { label: string; href: string; count?: number }[];
  relatedTitle?: string;
}) {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SaddleUp', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Saddles', item: `${SITE_URL}/saddles` },
        { '@type': 'ListItem', position: 3, name: breadcrumb, item: `${SITE_URL}${path}` }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: heading,
      description: intro,
      url: `${SITE_URL}${path}`,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: listings.length,
        itemListElement: listings.map((l, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE_URL}/saddles/${l.slug}`,
          name: `${l.seat_size}" ${l.brands?.name ?? ''} ${l.model}`.replace(/\s+/g, ' ')
        }))
      }
    }
  ];

  return (
    <div className="py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-saddle-muted mb-3">
        <Link href="/" className="hover:underline">SaddleUp</Link> ›{' '}
        <Link href="/saddles" className="hover:underline">Saddles</Link> › <span>{breadcrumb}</span>
      </nav>

      <h1 className="font-serif text-4xl text-saddle-ink mb-3">{heading} for Sale</h1>
      <p className="text-saddle-body max-w-3xl mb-2">{intro}</p>
      <p className="text-sm text-saddle-muted mb-6">
        {listings.length
          ? `${listings.length} saddle${listings.length === 1 ? '' : 's'} listed now.`
          : 'None listed right now.'}{' '}
        <Link href={searchHref} className="underline text-saddle-brown">
          Filter by seat size, tree width and price →
        </Link>
      </p>

      {listings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((l) => (
            <SaddleCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <div className="bg-saddle-paper border border-saddle-line rounded p-6 max-w-2xl">
          <p className="font-serif text-xl text-saddle-ink mb-1">Nothing here yet</p>
          <p className="text-sm text-saddle-muted">
            New saddles are added all the time.{' '}
            <Link href="/saddles" className="underline">Save a search as a list</Link> and new saddles that
            fit will show up there, or <Link href="/dashboard/listings/new" className="underline">sell yours here</Link>.
          </p>
        </div>
      )}

      {related && related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-saddle-ink mb-3">{relatedTitle}</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="bg-saddle-paper border border-saddle-line rounded-full px-4 py-2 text-sm text-saddle-nav hover:border-saddle-brown"
              >
                {r.label}
                {r.count ? <span className="text-saddle-muted"> ({r.count})</span> : null}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
