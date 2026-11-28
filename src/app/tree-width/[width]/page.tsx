import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FOR_SALE, searchUrl } from '@/lib/search';
import { createClient } from '@/lib/supabase/server';
import LandingPage from '@/components/LandingPage';
import { TREE_WIDTH_LABELS, type Listing, type TreeWidth } from '@/lib/types';
import { TREE_SLUGS, treeFromSlug, treeIntro, treePath } from '@/lib/seo';

// Landing page for one tree width, e.g. /tree-width/medium, so searches like "medium tree jumping
// saddle" have a page to land on. Same layout as the brand and discipline pages.

async function load(slug: string) {
  const tree = treeFromSlug(slug);
  if (!tree) return null;
  const supabase = createClient();
  const [{ data }, { data: all }] = await Promise.all([
    supabase
      .from('listings')
      .select('*, brands(name, slug)')
      .or(FOR_SALE)
      .eq('tree_width', tree)
      .order('created_at', { ascending: false })
      .limit(60),
    // For the "other tree widths" links.
    supabase.from('listings').select('tree_width').or(FOR_SALE).not('tree_width', 'is', null)
  ]);
  const counts = new Map<TreeWidth, number>();
  for (const l of all ?? []) {
    const t = l.tree_width as TreeWidth;
    if (t !== tree) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  // Narrowest to widest, adjustable last (the order of TREE_SLUGS).
  const order = Object.keys(TREE_SLUGS) as TreeWidth[];
  const others = order.filter((t) => counts.has(t)).map((t) => [t, counts.get(t)!] as const);
  return { tree, listings: (data ?? []) as Listing[], others };
}

export async function generateMetadata({ params }: { params: { width: string } }): Promise<Metadata> {
  const found = await load(params.width);
  if (!found) return {};
  const label = TREE_WIDTH_LABELS[found.tree];
  return {
    title: `Used ${label} Tree Saddles for Sale`,
    description: `Used ${label.toLowerCase()} tree saddles for sale, each listed with its exact seat size, condition and location so you can shop by fit.`,
    alternates: { canonical: treePath(found.tree) },
    // Keep empty pages out of search results until they have saddles.
    robots: found.listings.length ? undefined : { index: false, follow: true }
  };
}

export default async function TreeWidthPage({ params }: { params: { width: string } }) {
  const found = await load(params.width);
  if (!found) return notFound();
  const { tree, listings, others } = found;
  const label = TREE_WIDTH_LABELS[tree];
  return (
    <LandingPage
      heading={`Used ${label} Tree Saddles`}
      intro={treeIntro(tree, label)}
      path={treePath(tree)}
      breadcrumb={`${label} tree`}
      listings={listings}
      searchHref={searchUrl({ tree: [tree] })}
      relatedTitle="Other tree widths"
      related={others.map(([t, count]) => ({ label: TREE_WIDTH_LABELS[t], href: treePath(t), count }))}
    />
  );
}
