import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser, isUuid } from '@/lib/lists-server';
import ListDetail, { type ListItemView } from '@/components/lists/ListDetail';
import { searchUrl } from '@/lib/search';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My list', robots: { index: false } };

export default async function ListPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/auth/login?next=/lists/${params.id}`);
  if (!isUuid(params.id)) notFound();

  const [{ data: list }, { data: items }, { data: states }] = await Promise.all([
    supabase.from('buyer_lists').select('id, name, description, is_default, archived_at').eq('id', params.id).maybeSingle(),
    supabase
      .from('buyer_list_items')
      .select('listing_id, note, created_at, listings(id, slug, model, seat_size, tree_width, price_cents, images, condition, location_state, status, brands(name, slug))')
      .eq('list_id', params.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('my_saved_listing_states')
  ]);
  if (!list) notFound();

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
      />
    </div>
  );
}
