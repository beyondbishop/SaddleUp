import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FOR_SALE, searchUrl } from '@/lib/search';
import { createClient } from '@/lib/supabase/server';
import LandingPage from '@/components/LandingPage';
import type { Listing } from '@/lib/types';
import { seatFromSlug, seatIntro, seatPath } from '@/lib/seo';

// Landing page for one seat size, e.g. /seat-size/17-5, so searches like "17.5 close contact
// saddle" have a page to land on. Same layout as the brand and discipline pages.

async function load(slug: string) {
  const size = seatFromSlug(slug);
  if (size === null) return null;
  const supabase = createClient();
  const [{ data }, { data: all }] = await Promise.all([
    supabase
      .from('listings')
      .select('*, brands(name, slug)')
      .or(FOR_SALE)
      .eq('seat_size', size)
      .order('created_at', { ascending: false })
      .limit(60),
    // For the "other seat sizes" links.
    supabase.from('listings').select('seat_size').or(FOR_SALE)
  ]);
  const counts = new Map<number, number>();
  for (const l of all ?? []) {
    const s = Number(l.seat_size);
    if (s !== size) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return { size, listings: (data ?? []) as Listing[], others: Array.from(counts).sort((a, b) => a[0] - b[0]) };
}

export async function generateMetadata({ params }: { params: { size: string } }): Promise<Metadata> {
  const found = await load(params.size);
  if (!found) return {};
  return {
    title: `Used ${found.size}" Saddles for Sale`,
    description: `Used ${found.size}" saddles for sale — close contact, eventing, all purpose and more — each listed with its tree width, condition and location.`,
    alternates: { canonical: seatPath(found.size) },
    // Keep empty pages out of search results until they have saddles.
    robots: found.listings.length ? undefined : { index: false, follow: true }
  };
}

export default async function SeatSizePage({ params }: { params: { size: string } }) {
  const found = await load(params.size);
  if (!found) return notFound();
  const { size, listings, others } = found;
  return (
    <LandingPage
      heading={`Used ${size}" Saddles`}
      intro={seatIntro(size)}
      path={seatPath(size)}
      breadcrumb={`${size}" seat`}
      listings={listings}
      searchHref={searchUrl({ seat_min: size, seat_max: size })}
      relatedTitle="Other seat sizes"
      related={others.map(([s, count]) => ({ label: `${s}"`, href: seatPath(s), count }))}
    />
  );
}
