// POST /api/admin/moderate  { id: string, status: 'active' | 'removed' }
// Approves or rejects a listing. Admins only (checked here and by row-level security).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listingPaths, notifyIndexNow } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const { id, status } = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!id || (status !== 'active' && status !== 'removed')) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', id)
    .select('slug, discipline, brands(slug)')
    .single();
  if (error || !listing) {
    console.error('Moderation failed', error);
    return NextResponse.json({ error: `Couldn't update: ${error?.message ?? 'listing not found'}` }, { status: 400 });
  }
  // Approved: new page to index. Rejected: tell search engines to re-check (it's no longer public).
  await notifyIndexNow(listingPaths(listing as any));
  return NextResponse.json({ ok: true });
}
