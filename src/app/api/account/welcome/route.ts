// POST /api/account/welcome — called by the sign-up and sign-in pages once someone has a session.
// Sends the one-time welcome email if they haven't had it yet; otherwise does nothing.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWelcomeOnce } from '@/lib/welcome';

export async function POST() {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await sendWelcomeOnce(user.id);
  return NextResponse.json({ ok: true });
}
