// PATCH /api/imports/<listing id>
//   { messaged: boolean }   the importer ticks "I've messaged the seller"
//   { message: string }     the importer edits the message they'll send the seller
//   { unavailable: boolean } the post's seller says it's gone: hide the saddle but keep the record,
//                            so the same post is caught as a duplicate and never re-added
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';

const MAX_MESSAGE = 3000;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { messaged?: unknown; message?: unknown; unavailable?: unknown };

  if (typeof body.unavailable === 'boolean') return setUnavailable(params.id, body.unavailable, user.id, isAdmin);

  let update: Record<string, string | null>;
  if (typeof body.messaged === 'boolean') {
    update = { messaged_at: body.messaged ? new Date().toISOString() : null };
  } else if (typeof body.message === 'string') {
    if (body.message.length > MAX_MESSAGE) return NextResponse.json({ error: 'That message is too long.' }, { status: 400 });
    update = { message: body.message.trim() ? body.message : null };
  } else {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  let q = createAdminClient().from('listing_imports').update(update).eq('listing_id', params.id);
  if (!isAdmin) q = q.eq('importer_id', user.id); // importers can only update their own
  const { data, error } = await q.select('listing_id, messaged_at').maybeSingle();
  if (error) {
    console.error('Import update failed', error);
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ messaged_at: data.messaged_at });
}

/** Take an imported, not-yet-claimed saddle off the site (status 'removed'), or put it back. */
async function setUnavailable(listingId: string, unavailable: boolean, userId: string, isAdmin: boolean) {
  const admin = createAdminClient();
  const [{ data: imp }, { data: listing }] = await Promise.all([
    admin.from('listing_imports').select('importer_id').eq('listing_id', listingId).maybeSingle(),
    admin.from('listings').select('status, seller_id').eq('id', listingId).maybeSingle()
  ]);
  if (!imp || !listing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!isAdmin && imp.importer_id !== userId) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  // Once the seller has claimed it, it's theirs to manage.
  if (listing.seller_id) {
    return NextResponse.json({ error: 'The seller has claimed this saddle, so they manage it now.' }, { status: 409 });
  }
  const from = unavailable ? 'unclaimed' : 'removed';
  const to = unavailable ? 'removed' : 'unclaimed';
  if (listing.status === to) return NextResponse.json({ status: to });
  const { data, error } = await admin.from('listings').update({ status: to }).eq('id', listingId).eq('status', from).select('status').maybeSingle();
  if (error) {
    console.error('Import availability update failed', error);
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'This saddle changed in the meantime. Refresh and try again.' }, { status: 409 });
  return NextResponse.json({ status: data.status });
}
