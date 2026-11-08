import type { Metadata } from 'next';
import { FOR_SALE } from '@/lib/search';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingPage from '@/components/LandingPage';
import { DISCIPLINE_LABELS, type Listing } from '@/lib/types';
import { DISCIPLINE_INTROS, brandPath, disciplineFromSlug, disciplinePath } from '@/lib/seo';

async function load(slug: string) {
  const discipline = disciplineFromSlug(slug);
  if (!discipline) return null;
  const { data } = await createClient()
    .from('listings')
    .select('*, brands(name, slug)')
    .or(FOR_SALE)
    .eq('discipline', discipline)
    .order('created_at', { ascending: false })
    .limit(60);
  return { discipline, listings: (data ?? []) as Listing[] };
}

export async function generateMetadata({ params }: { params: { discipline: string } }): Promise<Metadata> {
  const found = await load(params.discipline);
  if (!found) return {};
  const { heading, intro } = DISCIPLINE_INTROS[found.discipline];
  return {
    title: `${heading} for Sale`,
    description: intro.split('. ')[0] + '.',
    alternates: { canonical: disciplinePath(found.discipline) },
    // Keep empty pages out of search results until they have saddles.
    robots: found.listings.length ? undefined : { index: false, follow: true }
  };
}

export default async function DisciplinePage({ params }: { params: { discipline: string } }) {
  const found = await load(params.discipline);
  if (!found) return notFound();
  const { discipline, listings } = found;
  const { heading, intro } = DISCIPLINE_INTROS[discipline];

  const brandCounts = new Map<string, { name: string; count: number }>();
  for (const l of listings) {
    const b = l.brands;
    if (!b || b.slug === 'other') continue;
    brandCounts.set(b.slug, { name: b.name, count: (brandCounts.get(b.slug)?.count ?? 0) + 1 });
  }

  return (
    <LandingPage
      heading={heading}
      intro={intro}
      path={disciplinePath(discipline)}
      breadcrumb={DISCIPLINE_LABELS[discipline]}
      listings={listings}
      searchHref={`/saddles?discipline=${discipline}`}
      relatedTitle={`${DISCIPLINE_LABELS[discipline]} saddles by brand`}
      related={Array.from(brandCounts, ([slug, b]) => ({ label: b.name, href: brandPath(slug), count: b.count }))}
    />
  );
}
