// POST /api/admin/test-email  { kind: 'welcome' }
// Admins only: sends the welcome email to the admin's own address and returns exactly what
// Resend said, so a sending problem shows up on the page instead of failing silently.
// Doesn't touch anyone's "welcome sent" record.

import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/roles';
import { emailConfigured, sendEmail } from '@/lib/messaging';
import { WELCOME_FROM, welcomeEmail } from '@/lib/welcome';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { user, isAdmin, supabase } = await getViewer();
  if (!user || !isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown };
  if (body.kind !== 'welcome') return NextResponse.json({ error: 'Unknown email.' }, { status: 400 });
  if (!user.email) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 });

  const setup = {
    resendKey: !!process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM ?? null,
    sendsFrom: WELCOME_FROM
  };
  if (!emailConfigured()) return NextResponse.json({ status: 'skipped', detail: 'Email isn’t set up on the live site.', setup });

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const { subject, html, text } = welcomeEmail(profile?.full_name ?? null);
  const result = await sendEmail({
    to: user.email,
    from: WELCOME_FROM,
    subject: `[Test] ${subject}`,
    html,
    text,
    idempotencyKey: `test-welcome-${user.id}-${Date.now()}`
  });
  return NextResponse.json({ ...result, to: user.email, setup });
}
