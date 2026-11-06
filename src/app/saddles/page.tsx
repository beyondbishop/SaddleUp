import { createClient } from '@/lib/supabase/server';
import FilterSidebar from '@/components/FilterSidebar';
import SaddleCard from '@/components/SaddleCard';
import { DISCIPLINE_LABELS, TREE_WIDTH_LABELS, Listing } from '@/lib/types';
import type { Metadata } from 'next';
import { brandPath, disciplinePath } from '@/lib/seo';
import type { Discipline } from '@/lib/types';
import { applyCriteria, describeCriteria, filtersOnOptionalDetails, hasCriteria, parseCriteria, searchUrl } from '@/lib/search';
import SaveSearchButton from '@/components/lists/SaveSearchButton';
import ListCriteriaBanner from '@/components/lists/ListCriteriaBanner';
import { isUuid } from '@/lib/lists-server';

const PAGE_SIZE = 48;

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
  const used = Object.entries(searchParams).filter(([, v]) => v !== undefined && v !== '');
  const only = used.length === 1 ? used[0] : null;
  const disciplineKey = only?.[0] === 'discipline' ? String(only[1]) : null;
  const canonical =
    disciplineKey && disciplineKey in DISCIPLINE_LABELS
      ? disciplinePath(disciplineKey as Discipline)
      : only?.[0] === 'brand'
        ? brandPath(String(only[1]))
        : '/saddles';
  return {
    title,
    description: `${title} on SaddleUp — matched to your horse's back width and your seat size. Buy direct from verified sellers.`,
    alternates: { canonical },
    // Combinations of several filters are for shoppers, not for search results.
    robots: used.length > 1 ? { index: false, follow: true } : undefined
  };
}

export default async function SaddlesPage({ searchParams }: { searchParams: SP }) {
  const supabase = createClient();
  const { data: brands } = await supabase.from('brands').select('id, name, slug').order('name');
  const criteria = parseCriteria(searchParams);
  const brand = criteria.brand ? brands?.find((b) => b.slug === criteria.brand) : undefined;

  const query = applyCriteria(
    supabase
      .from('listings')
      .select('*, brands(name, slug)', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    criteria,
    brand?.id ?? null
  );
  const { data: listings, count, error } = await query.limit(PAGE_SIZE);
  const total = count ?? listings?.length ?? 0;
  const summary = describeCriteria(criteria, brand?.name);

  const {
    data: { user }
  } = await supabase.auth.getUser();
  // /saddles?list=<id>: choosing filters for one of the buyer's lists.
  const listParam = Array.isArray(searchParams.list) ? searchParams.list[0] : searchParams.list;
  const editingList =
    user && isUuid(listParam)
      ? (await supabase.from('buyer_lists').select('id, name').eq('id', listParam).maybeSingle()).data
      : null;
  const keepList = (url: string) =>
    editingList ? `${url}${url.includes('?') ? '&' : '?'}list=${editingList.id}` : url;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 py-8">
      <FilterSidebar brands={brands ?? []} criteria={criteria} listId={editingList?.id} />
      <div>
        {editingList && (
          <ListCriteriaBanner listId={editingList.id} listName={editingList.name} hasFilters={hasCriteria(criteria)} />
        )}
        <h1 className="text-2xl font-bold text-saddle-brown">
          {total} {total === 1 ? 'saddle' : 'saddles'} found
        </h1>
        {summary.length > 0 && (
          <p className="text-sm text-gray-600 mt-1">
            {summary.join(' · ')} ·{' '}
            <a href={keepList('/saddles')} className="underline">Clear filters</a>
          </p>
        )}
        {!editingList && hasCriteria(criteria) && (
          <div className="mt-3">
            <SaveSearchButton suggestedName={summary.slice(0, 3).join(', ')} signedIn={!!user} />
          </div>
        )}
        {total > PAGE_SIZE && (
          <p className="text-sm text-gray-500 mt-1">Showing the newest {PAGE_SIZE}. Narrow your filters to see more.</p>
        )}
        {error && <p className="text-red-600 text-sm my-4">Something went wrong loading saddles. Please try again.</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {(listings as unknown as Listing[] | null)?.map((listing) => (
            <SaddleCard key={listing.id} listing={listing} />
          ))}
        </div>
        {!error && total === 0 && (
          <div className="text-center py-16">
            <p className="mb-2">No saddles match those filters yet.</p>
            {filtersOnOptionalDetails(criteria) && !criteria.include_unknown && (
              <p className="mb-4 text-sm">
                <a href={keepList(searchUrl({ ...criteria, include_unknown: true }))} className="text-saddle-green underline">
                  Include saddles where the seller didn&apos;t state those details
                </a>
              </p>
            )}
            {!editingList && hasCriteria(criteria) && (
              <p className="text-sm text-gray-600">
                Save this search as a list above, and new matches will show up there as they&apos;re listed.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
