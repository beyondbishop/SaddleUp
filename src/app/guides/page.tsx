import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDES } from '@/content/guides';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Saddle Guides: Buying, Selling and Fitting Used Saddles',
  description:
    'Practical guides from SaddleUp on buying, selling and fitting used saddles: where to sell, what saddles are worth, and how to find one that fits your horse.',
  alternates: { canonical: `${SITE_URL}/guides` }
};

const eyebrow = 'font-mono uppercase text-saddle-gold text-[11px] tracking-[0.22em]';

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export default function GuidesIndex() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'SaddleUp Guides',
    url: `${SITE_URL}/guides`,
    hasPart: GUIDES.map((g) => ({
      '@type': 'Article',
      headline: g.title,
      url: `${SITE_URL}/guides/${g.slug}`,
      datePublished: g.published
    }))
  };

  return (
    <div className="max-w-[860px] mx-auto py-10 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={`${eyebrow} mb-4`}>Guides</div>
      <h1 className="font-serif font-normal text-[34px] sm:text-[44px] leading-[1.05] text-saddle-ink mb-4">
        Saddle guides
      </h1>
      <p className="text-lg leading-relaxed text-saddle-body mb-10 max-w-[620px]">
        Straight answers on buying, selling and fitting used saddles, from a horse family that has done all three.
      </p>

      <div className="divide-y divide-saddle-line border-y border-saddle-line">
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="block py-7 group">
            <div className="text-[13px] text-saddle-muted mb-1.5">
              {shortDate(g.published)} · {g.readMinutes} min read
            </div>
            <h2 className="font-serif text-[24px] sm:text-[27px] leading-tight text-saddle-ink group-hover:text-saddle-brown mb-2">
              {g.title}
            </h2>
            <p className="text-[16px] leading-relaxed text-saddle-body">{g.summary}</p>
            <div className="mt-3 text-[14px] font-semibold text-saddle-brown">Read the guide →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
