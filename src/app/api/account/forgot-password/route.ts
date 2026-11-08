// POST /api/account/forgot-password { email }
// "Forgot password?" on the sign-in page. Emails the same one-time sign-in link admins can send
// from the Users page. Always answers the same way, so it never reveals who has an account.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendLoginLink } from '@/lib/login-link';

const OK = NextResponse.json({ ok: true });
/** At most one link per person per minute, so the form can't be used to flood someone's inbox. */
const WAIT_MS = 60_000;

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  const clean = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const pattern = clean.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: profile } = await admin.from('profiles').select('id').ilike('email', pattern).maybeSingle();
    if (!profile) return OK;

    const { data } = await admin.auth.admin.getUserById(profile.id);
    const u = data?.user;
    if (!u) return OK;
    if (u.banned_until && new Date(u.banned_until) > new Date()) return OK; // frozen
    const lastSent = (u as any).recovery_sent_at as string | undefined;
    if (lastSent && Date.now() - new Date(lastSent).getTime() < WAIT_MS) return OK;

    const result = await sendLoginLink(profile.id);
    if (result.status !== 'sent') console.error('Forgot-password email not sent', result.status, result.detail);
  } catch (e) {
    console.error('Forgot-password error', e);
  }
  return OK;
}
