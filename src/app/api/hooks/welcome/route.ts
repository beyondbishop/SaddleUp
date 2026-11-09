// POST /api/hooks/welcome  { user_id }
// Called by the database the moment someone's email is confirmed (or right away for Google
// sign-ups, which arrive confirmed), so the welcome email goes out then, whatever browser or
// device they confirmed on. Needs no secret: it only ever sends a confirmed person their own
// welcome, once, so calling it for anyone else does nothing.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendWelcomeOnce } from '@/lib/welcome';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { user_id?: unknown };
  const userId = typeof body.user_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.user_id) ? body.user_id : null;
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  if (!data?.user) return NextResponse.json({ status: 'no_user' });
  if (!data.user.email_confirmed_at) return NextResponse.json({ status: 'not_confirmed' });

  const status = await sendWelcomeOnce(userId);
  return NextResponse.json({ status });
}
