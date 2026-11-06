// POST /api/admin/rewards { rewardIds: string[] (order ids), note?: string }
// Admin records that they've paid these rewards (e.g. by Venmo). Only 'earned' rewards change.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { isUuid } from '@/lib/lists-server';

export async function POST(req: Request) {
  const { user, isAdmin } = await getViewer();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.rewardIds) ? body.rewardIds.filter(isUuid).slice(0, 500) : [];
  if (!ids.length) return NextResponse.json({ error: 'Nothing selected.' }, { status: 400 });
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) || null : null;

  const { data, error } = await createAdminClient()
    .from('importer_rewards')
    .update({ status: 'paid', paid_at: new Date().toISOString(), paid_note: note, paid_by: user.id })
    .in('order_id', ids)
    .eq('status', 'earned')
    .select('order_id, amount_cents');
  if (error) return NextResponse.json({ error: 'Could not record the payment.' }, { status: 500 });
  return NextResponse.json({
    paid: data?.length ?? 0,
    totalCents: (data ?? []).reduce((s, r) => s + r.amount_cents, 0)
  });
}
