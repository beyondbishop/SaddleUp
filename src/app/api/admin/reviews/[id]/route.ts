// POST /api/admin/reviews/<id>  { hidden: boolean }   admins only
// Take a review off the website (homepage, seller profile, listings) or put it back.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user || !isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.hidden !== 'boolean') return NextResponse.json({ error: 'Say whether to hide it.' }, { status: 400 });
  const { data, error } = await createAdminClient().from('reviews').update({ hidden: body.hidden }).eq('id', params.id).select('id').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Could not update the review.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
