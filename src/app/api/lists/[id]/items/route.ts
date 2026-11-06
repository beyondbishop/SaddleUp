// PUT    /api/lists/<id>/items { listingId, note?, via? }   save a saddle to the list (repeat-safe);
//        via: 'suggestion' when added from the list's suggested matches
// PATCH  /api/lists/<id>/items { listingId, note }    change the private note
// DELETE /api/lists/<id>/items?listing=<listingId>   remove; returns the note so it can be undone
import { NextResponse } from 'next/server';
import { requireUser, unauthorized, bad, cleanText, isUuid } from '@/lib/lists-server';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (!isUuid(params.id) || !isUuid(body.listingId)) return bad('Not found.', 404);

  // Only saddles the buyer can see (for sale, or already on their lists) can be saved.
  const { data: listing } = await supabase.from('listings').select('id').eq('id', body.listingId).maybeSingle();
  if (!listing) return bad('That saddle is no longer available.', 404);

  const note = cleanText(body.note, 2000);
  const { error } = await supabase
    .from('buyer_list_items')
    .upsert(
      {
        list_id: params.id,
        listing_id: body.listingId,
        user_id: user.id,
        added_via: body.via === 'suggestion' ? 'suggestion' : 'manual',
        ...(note ? { note } : {})
      },
      { ignoreDuplicates: true }
    );
  if (error) return error.code === '42501' ? bad('List not found.', 404) : bad('Could not save.', 500);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (!isUuid(params.id) || !isUuid(body.listingId)) return bad('Not found.', 404);
  const note = cleanText(body.note, 2000);
  if (note === undefined) return bad('Nothing to save.');

  const { data, error } = await supabase
    .from('buyer_list_items')
    .update({ note })
    .eq('list_id', params.id)
    .eq('listing_id', body.listingId)
    .select('note')
    .maybeSingle();
  if (error) return bad('Could not save your note.', 500);
  if (!data) return bad('That saddle is no longer on this list.', 404);
  return NextResponse.json({ note: data.note });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorized();
  const listingId = new URL(req.url).searchParams.get('listing');
  if (!isUuid(params.id) || !isUuid(listingId)) return bad('Not found.', 404);

  const { data, error } = await supabase
    .from('buyer_list_items')
    .delete()
    .eq('list_id', params.id)
    .eq('listing_id', listingId)
    .select('note');
  if (error) return bad('Could not remove.', 500);
  return NextResponse.json({ removed: !!data?.length, note: data?.[0]?.note ?? null });
}
