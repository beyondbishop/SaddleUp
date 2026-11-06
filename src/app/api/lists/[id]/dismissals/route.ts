// POST   /api/lists/<id>/dismissals { listingId }    hide a suggested saddle from this list only
// DELETE /api/lists/<id>/dismissals?listing=<id>     undo
import { NextResponse } from 'next/server';
import { requireUser, unauthorized, bad, isUuid } from '@/lib/lists-server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (!isUuid(params.id) || !isUuid(body.listingId)) return bad('Not found.', 404);
  const { error } = await supabase
    .from('buyer_list_dismissals')
    .upsert({ list_id: params.id, listing_id: body.listingId, user_id: user.id }, { ignoreDuplicates: true });
  if (error) return error.code === '42501' ? bad('List not found.', 404) : bad('Could not dismiss.', 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return unauthorized();
  const listingId = new URL(req.url).searchParams.get('listing');
  if (!isUuid(params.id) || !isUuid(listingId)) return bad('Not found.', 404);
  const { error } = await supabase.from('buyer_list_dismissals').delete().eq('list_id', params.id).eq('listing_id', listingId);
  if (error) return bad('Could not undo.', 500);
  return NextResponse.json({ ok: true });
}
