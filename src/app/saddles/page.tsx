import { createClient } from '@/lib/supabase/server';
import FilterSidebar from '@/components/FilterSidebar';
import SaddleCard from '@/components/SaddleCard';
import { DISCIPLINE_LABELS, TREE_WIDTH_LABELS, Listing } from '@/lib/types';
import type { Metadata } from 'next';

type SP = Record<string, string | string[] | undefined>;

// Build a human-readable, SEO-friendly title/description from whatever
// filters are active — e.g. "16.5in Antares Medium Tree Hunter/Jumper Saddles"
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const parts: string[] = [];
  if (searchParams.seat_min) parts.push(`${searchParams.seat_min}in`);
  if (searchParams.brand) parts.push(String(searchParams.brand));
  if (searchParams.tree) {
    const trees = Array.isArray(searchParams.tree) ? searchParams.tree : [searchParams.tree];
    parts.push(trees.map((t) => TREE_WIDTH_LABELS[t as keyof typeof TREE_WIDTH_LABELS] ?? t).join('/') + ' Tree');
  }
  if (searchParams.discipline) {
    parts.push(DISCIPLINE_LABELS[searchParams.discipline as keyof typeof DISCIPLINE_LABELS] ?? '');
  }
  const title = parts.length ? `${parts.join(' ')} Saddles For Sale` : 'Browse Saddles For Sale';
  return {
    title,
    description: `${title} on SaddleUp — matched to your horse's back width and your seat size. Buy direct from verified sellers.`
  };
}

export default async function SaddlesPage({ searchParams }: { searchParams: SP }) {
  const supabase = createClient();
  const { data: brands } = await supabase.from('brands').select('id, name, slug');

  let query = supabase
    .from('listings')
    .select('*, brands(name, slug)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  if (one(searchParams.discipline)) query = query.eq('discipline', one(searchParams.discipline)!);
  if (one(searchParams.brand)) {
    const brand = brands?.find((b) => b.slug === one(searchParams.brand));
    if (brand) query = query.eq('brand_id', brand.id);
  }
  if (one(searchParams.seat_min)) query = query.gte('seat_size', Number(one(searchParams.seat_min)));
  if (one(searchParams.seat_max)) query = query.lte('seat_size', Number(one(searchParams.seat_max)));
  if (one(searchParams.price_max)) query = query.lte('price_cents', Number(one(searchParams.price_max)) * 100);
  if (searchParams.tree) {
    const trees = Array.isArray(searchParams.tree) ? searchParams.tree : [searchParams.tree];
    query = query.in('tree_width', trees);
  }

  const { data: listings, error } = await query.limit(48);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 py-8">
      <FilterSidebar brands={brands ?? []} searchParams={searchParams} />
      <div>
        <h1 className="text-2xl font-bold text-saddle-brown mb-4">
          {listings?.length ?? 0} saddles found
        </h1>
        {error && <p className="text-red-600 text-sm mb-4">{error.message}</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(listings as unknown as Listing[] | null)?.map((listing) => (
            <SaddleCard key={listing.id} listing={listing} />
          ))}
        </div>
        {listings?.length === 0 && (
          <div className="text-center py-16">
            <p className="mb-4">No saddles match those filters yet.</p>
            <a href="/watchlist" className="text-saddle-green underline">
              Save this search and we&apos;ll email you when one is listed
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
