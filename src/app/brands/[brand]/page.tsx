import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingPage from '@/components/LandingPage';
import { DISCIPLINE_LABELS, type Discipline, type Listing } from '@/lib/types';
import { brandPath, disciplinePath } from '@/lib/seo';
import { brandInfo } from '@/lib/saddle-catalog';

async function load(slug: string) {
  const supabase = createClient();
  const { data: brand } = await supabase.from('brands').select('id, name, slug').eq('slug', slug).maybeSingle();
  if (!brand || brand.slug === 'other') return null;
  const { data } = await supabase
    .from('listings')
    .select('*, brands(name, slug)')
    .eq('status', 'active')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })
    .limit(60);
  return { brand, listings: (data ?? []) as Listing[] };
}

function introFor(name: string) {
  const type = brandInfo(name).type;
  const kind = type === 'western' ? 'western ' : type === 'english' ? 'English ' : '';
  return `Used ${name} ${kind}saddles for sale on SaddleUp, each listed with its exact seat size, tree width, condition and location so you can find a ${name} that fits your horse and you.`;
}

export async function generateMetadata({ params }: { params: { brand: string } }): Promise<Metadata> {
  const found = await load(params.brand);
  if (!found) return {};
  return {
    title: `Used ${found.brand.name} Saddles for Sale`,
    description: introFor(found.brand.name),
    alternates: { canonical: brandPath(found.brand.slug) },
    robots: found.listings.length ? undefined : { index: false, follow: true }
  };
}

export default async function BrandPage({ params }: { params: { brand: string } }) {
  const found = await load(params.brand);
  if (!found) return notFound();
  const { brand, listings } = found;

  const disciplineCounts = new Map<Discipline, number>();
  for (const l of listings) disciplineCounts.set(l.discipline, (disciplineCounts.get(l.discipline) ?? 0) + 1);

  return (
    <LandingPage
      heading={`Used ${brand.name} Saddles`}
      intro={introFor(brand.name)}
      path={brandPath(brand.slug)}
      breadcrumb={brand.name}
      listings={listings}
      searchHref={`/saddles?brand=${brand.slug}`}
      relatedTitle={`${brand.name} saddles by discipline`}
      related={Array.from(disciplineCounts, ([d, count]) => ({ label: DISCIPLINE_LABELS[d], href: disciplinePath(d), count }))}
    />
  );
}
