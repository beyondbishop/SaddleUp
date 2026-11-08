import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser, isUuid, storedCriteria } from '@/lib/lists-server';
import ListDetail, { type ListItemView, type SuggestionView } from '@/components/lists/ListDetail';
import { applyCriteria, criteriaToParams, describeCriteria, matchListing, searchUrl, FOR_SALE } from '@/lib/search';

const SUGGESTION_LIMIT = 24;
const LISTING_FIELDS =
  'id, slug, model, discipline, seat_size, tree_width, price_cents, images, condition, location_state, panel_flocking, panel_type, status, brands(name, slug)';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My list', robots: { index: false } };

export default async function ListPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { criteria?: string };
}) {
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/auth/login?next=/lists/${params.id}`);
  if (!isUuid(params.id)) notFound();

  const [{ data: list }, { data: items }, { data: states }, { data: dismissals }] = await Promise.all([
    supabase.from('buyer_lists').select('id, name, description, is_default, archived_at, criteria').eq('id', params.id).maybeSingle(),
    supabase
      .from('buyer_list_items')
      .select(`listing_id, note, created_at, listings(${LISTING_FIELDS})`)
      .eq('list_id', params.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('my_saved_listing_states'),
    supabase.from('buyer_list_dismissals').select('listing_id').eq('list_id', params.id)
  ]);
  if (!list) notFound();

  // Suggested matches: saddles for sale that meet the list's criteria and aren't already on
  // the list or dismissed from it. Same matching rules as the browse page.
  const criteria = storedCriteria(list.criteria);
  let suggestions: SuggestionView[] = [];
  let totalMatches = 0;
  let criteriaView = null;
  if (criteria) {
    const exclude = new Set([...(items ?? []).map((i: any) => i.listing_id), ...(dismissals ?? []).map((d) => d.listing_id)]);
    const brand = criteria.brand
      ? (await supabase.from('brands').select('id, name').eq('slug', criteria.brand).maybeSingle()).data
      : null;
    const { data: matches, count } = await applyCriteria(
      supabase.from('listings').select(LISTING_FIELDS, { count: 'exact' }).or(FOR_SALE).order('created_at', { ascending: false }),
      criteria,
      brand?.id ?? null
    ).limit(SUGGESTION_LIMIT + exclude.size);
    const fresh = (matches ?? []).filter((m: any) => !exclude.has(m.id));
    totalMatches = count ?? 0;
    suggestions = fresh.slice(0, SUGGESTION_LIMIT).map((m: any) => {
      const why = matchListing(m, criteria);
      return { listing: m, reasons: why.reasons, unknown: why.unknown };
    });
    criteriaView = {
      summary: describeCriteria(criteria, brand?.name),
      editUrl: `/saddles?${criteriaToParams(criteria).toString()}&list=${list.id}`,
      browseUrl: searchUrl(criteria),
      justUpdated: searchParams.criteria === 'updated'
    };
  }

  const stateById = new Map((states ?? []).map((s: any) => [s.listing_id, s]));
  const views: ListItemView[] = (items ?? []).map((i: any) => {
    const s: any = stateById.get(i.listing_id);
    const availability = (s?.availability ?? 'unavailable') as ListItemView['availability'];
    const similar = s
      ? searchUrl({
          discipline: s.discipline,
          seat_min: Number(s.seat_size) - 0.5,
          seat_max: Number(s.seat_size) + 0.5,
          tree: [s.tree_width]
        })
      : '/saddles';
    // Content only for saddles still for sale; withdrawn or sold ones show a placeholder.
    const listing = availability === 'available' || availability === 'in_checkout' ? i.listings : null;
    return { listingId: i.listing_id, note: i.note, savedAt: i.created_at, availability, listing, similarUrl: similar };
  });

  return (
    <div className="py-8">
      <Link href="/lists" className="text-sm underline text-gray-600">← My lists</Link>
      <ListDetail
        list={{ id: list.id, name: list.name, description: list.description, isDefault: list.is_default, archived: !!list.archived_at }}
        initialItems={views}
        criteria={criteriaView}
        initialSuggestions={suggestions}
        totalMatches={totalMatches}
      />
    </div>
  );
}
