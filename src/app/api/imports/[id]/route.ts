// PATCH /api/imports/<listing id> { messaged: boolean }   the importer ticks "I've messaged the seller"
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { messaged } = await req.json().catch(() => ({}));
  if (typeof messaged !== 'boolean') return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  let q = createAdminClient()
    .from('listing_imports')
    .update({ messaged_at: messaged ? new Date().toISOString() : null })
    .eq('listing_id', params.id);
  if (!isAdmin) q = q.eq('importer_id', user.id); // importers can only update their own
  const { data, error } = await q.select('messaged_at').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ messaged_at: data.messaged_at });
}
