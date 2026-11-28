import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL, brandPath, disciplinePath, seatPath, treePath } from '@/lib/seo';
import type { Discipline, TreeWidth } from '@/lib/types';
import { GUIDES } from '@/content/guides';
import { FOR_SALE } from '@/lib/search';

// Served at /sitemap.xml and rebuilt at most hourly. Lists every public page search engines
// should know about: core pages, each listing shoppers can see (live or unclaimed-but-showing), and the discipline/brand landing pages that
// seat size/tree width landing pages that
// currently have saddles (empty landing pages are left out so they don't count as thin content).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public data only, so the anonymous key is enough (and no cookies are needed here).
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: listings } = await supabase
    .from('listings')
    .select('slug, updated_at, discipline, seat_size, tree_width, brands(slug)')
    .or(FOR_SALE)
    .order('updated_at', { ascending: false });

  const now = new Date();
  const latest = listings?.[0]?.updated_at ? new Date(listings[0].updated_at) : now;

  const core: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: latest, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/saddles`, lastModified: latest, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, changeFrequency: 'yearly', priority: 0.5 },
    {
      url: `${SITE_URL}/guides`,
      lastModified: GUIDES[0] ? new Date(GUIDES[0].updated) : undefined,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    ...GUIDES.map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: new Date(g.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.7
    })),
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/seller-agreement`, changeFrequency: 'yearly', priority: 0.2 }
  ];

  const disciplines = new Map<Discipline, Date>();
  const brands = new Map<string, Date>();
  const seats = new Map<number, Date>();
  const trees = new Map<TreeWidth, Date>();
  const newest = <K,>(m: Map<K, Date>, k: K, d: Date) => {
    if (!m.has(k) || m.get(k)! < d) m.set(k, d);
  };
  for (const l of listings ?? []) {
    const updated = new Date(l.updated_at);
    newest(seats, Number(l.seat_size), updated);
    if (l.tree_width) newest(trees, l.tree_width as TreeWidth, updated);
    const d = l.discipline as Discipline;
    if (!disciplines.has(d) || disciplines.get(d)! < updated) disciplines.set(d, updated);
    const brandSlug = (l.brands as unknown as { slug: string } | null)?.slug;
    if (brandSlug && brandSlug !== 'other' && (!brands.has(brandSlug) || brands.get(brandSlug)! < updated)) {
      brands.set(brandSlug, updated);
    }
  }

  return [
    ...core,
    ...Array.from(disciplines, ([d, lastModified]) => ({
      url: `${SITE_URL}${disciplinePath(d)}`,
      lastModified,
      changeFrequency: 'daily' as const,
      priority: 0.8
    })),
    ...Array.from(brands, ([slug, lastModified]) => ({
      url: `${SITE_URL}${brandPath(slug)}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7
    })),
    ...Array.from(seats, ([size, lastModified]) => ({
      url: `${SITE_URL}${seatPath(size)}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7
    })),
    ...Array.from(trees, ([t, lastModified]) => ({
      url: `${SITE_URL}${treePath(t)}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7
    })),
    ...(listings ?? []).map((l) => ({
      url: `${SITE_URL}/saddles/${l.slug}`,
      lastModified: new Date(l.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8
    }))
  ];
}
