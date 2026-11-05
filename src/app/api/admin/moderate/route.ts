// POST /api/admin/moderate  { id: string, status: 'active' | 'removed' }
// Approves or rejects a listing. Admins only (checked here and by row-level security).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const { error } = await supabase.from('listings').update({ status }).eq('id', id);
  if (error) {
    console.error('Moderation failed', error);
    return NextResponse.json({ error: `Couldn't update: ${error.message}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
