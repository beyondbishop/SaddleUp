import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GUIDES, getGuide } from '@/content/guides';
import { H2 } from '@/components/guides/Prose';
import { SITE_URL } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = getGuide(params.slug);
  if (!g) return {};
  const url = `${SITE_URL}/guides/${g.slug}`;
  return {
    title: { absolute: g.metaTitle },
    description: g.description,
    alternates: { canonical: url },
    authors: [{ name: 'Danielle Bishop', url: `${SITE_URL}/about` }],
    openGraph: {
      type: 'article',
      url,
      title: g.title,
      description: g.description,
      publishedTime: g.published,
      modifiedTime: g.updated,
      authors: ['Danielle Bishop'],
      images: [{ url: '/preview.png', width: 1200, height: 630, alt: 'SaddleUp' }]
    },
    twitter: { card: 'summary_large_image', title: g.title, description: g.description, images: ['/preview.png'] }
  };
}

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export default function GuidePage({ params }: { params: { slug: string } }) {
  const g = getGuide(params.slug);
  if (!g) notFound();
  const url = `${SITE_URL}/guides/${g.slug}`;
  const { Body, Conclusion } = g;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: g.title,
        description: g.description,
        abstract: g.summary,
        url,
        mainEntityOfPage: url,
        datePublished: g.published,
        dateModified: g.updated,
        image: `${SITE_URL}/preview.png`,
        inLanguage: 'en-US',
        author: { '@type': 'Person', name: 'Danielle Bishop', jobTitle: 'Founder', url: `${SITE_URL}/about` },
        publisher: { '@type': 'Organization', name: 'SaddleUp', url: SITE_URL, logo: `${SITE_URL}/images/logo-square.png` },
        citation: g.sources.map(([name, u]) => ({ '@type': 'CreativeWork', name, url: u }))
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: g.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/guides` },
          { '@type': 'ListItem', position: 3, name: g.title, item: url }
        ]
      }
    ]
  };

  return (
    <article className="max-w-[720px] mx-auto py-10 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-[13px] text-saddle-muted mb-6">
        <Link href="/" className="hover:text-saddle-brown">Home</Link>
        <span className="mx-1.5">/</span>
        <Link href="/guides" className="hover:text-saddle-brown">Guides</Link>
      </nav>

      <h1 className="font-serif font-normal text-[32px] sm:text-[44px] leading-[1.08] text-saddle-ink mb-6">{g.title}</h1>

      <div className="flex items-center gap-3 mb-8">
        <Image
          src="/images/danielle-headshot.jpg"
          alt="Danielle Bishop"
          width={44}
          height={44}
          className="rounded-full object-cover w-11 h-11 border border-saddle-line"
        />
        <div className="text-[14px] leading-snug">
          <Link href="/about" className="font-semibold text-saddle-ink hover:text-saddle-brown">Danielle Bishop</Link>
          <span className="text-saddle-muted">, founder of SaddleUp</span>
          <div className="text-saddle-muted">
            <time dateTime={g.published}>{longDate(g.published)}</time>
            {g.updated !== g.published && (
              <> · Updated <time dateTime={g.updated}>{longDate(g.updated)}</time></>
            )}
            {' · '}
            {g.readMinutes} min read
          </div>
        </div>
      </div>

      <div className="mb-10 rounded-[3px] border border-saddle-line bg-saddle-paper px-5 py-4">
        <div className="font-mono uppercase text-saddle-gold text-[11px] tracking-[0.22em] mb-1.5">The short answer</div>
        <p className="text-[16.5px] leading-relaxed text-saddle-body">{g.summary}</p>
      </div>

      <Body />

      <H2 id="faq">Frequently asked questions</H2>
      <div className="divide-y divide-saddle-line border-y border-saddle-line mb-4">
        {g.faqs.map((f) => (
          <div key={f.q} className="py-5">
            <h3 className="font-serif text-[19px] text-saddle-ink mb-1.5">{f.q}</h3>
            <p className="text-[16.5px] leading-[1.7] text-saddle-body">{f.a}</p>
          </div>
        ))}
      </div>

      {Conclusion && <Conclusion />}

      <section className="mt-12 pt-6 border-t border-saddle-line">
        <h2 className="font-mono uppercase text-saddle-gold text-[11px] tracking-[0.22em] mb-3">Sources and further reading</h2>
        <ul className="space-y-1.5 text-[14.5px]">
          {g.sources.map(([label, u]) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noopener noreferrer" className="text-saddle-brown underline underline-offset-2 hover:text-saddle-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-[13px] italic text-saddle-muted mt-5">
          Published {longDate(g.published)}. Marketplace fees, policies, and available services may change. Verify terms
          with each provider before listing.
        </p>
      </section>
    </article>
  );
}
