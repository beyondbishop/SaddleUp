// PATCH /api/imports/<listing id>
//   { messaged: boolean }   the importer ticks "I've messaged the seller"
//   { message: string }     the importer edits the message they'll send the seller
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';

const MAX_MESSAGE = 3000;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { messaged?: unknown; message?: unknown };

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
