// POST /api/admin/test-email  { kind: 'welcome' }
// Admins only: sends the welcome email to the admin's own address and returns exactly what
// Resend said, so a sending problem shows up on the page instead of failing silently.
// Doesn't touch anyone's "welcome sent" record.

import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/roles';
import { emailConfigured, sendEmail } from '@/lib/messaging';
import { WELCOME_FROM, welcomeEmail } from '@/lib/welcome';
import { orderEmailForTest } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { user, isAdmin, supabase } = await getViewer();
  if (!user || !isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown };
  // Order emails: 'order:<event>:<role>', with a sample sale made today and your first name.
  const orderKind = typeof body.kind === 'string' ? /^order:([a-z_0-9]+):(buyer|seller)$/.exec(body.kind) : null;
  if (body.kind !== 'welcome' && !orderKind) return NextResponse.json({ error: 'Unknown email.' }, { status: 400 });
  if (!user.email) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 });

  const setup = {
    resendKey: !!process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM ?? null,
    sendsFrom: WELCOME_FROM
  };
  if (!emailConfigured()) return NextResponse.json({ status: 'skipped', detail: 'Email isn’t set up on the live site.', setup });

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const first = profile?.full_name?.trim().split(/\s+/)[0] ?? null;
  let email: { subject: string; html: string; text: string; from?: string } | null;
  if (orderKind) {
    const [, event, role] = orderKind;
    email = orderEmailForTest(event, role as 'buyer' | 'seller', first);
    if (!email) return NextResponse.json({ error: 'No such order email.' }, { status: 400 });
  } else {
    email = { ...welcomeEmail(profile?.full_name ?? null), from: WELCOME_FROM };
  }
  const { subject, html, text } = email;
  const result = await sendEmail({
    to: user.email,
    from: email.from,
    subject: `[Test] ${subject}`,
    html,
    text,
    idempotencyKey: `test-${String(body.kind).replace(/[^a-z_]/g, '-')}-${user.id}-${Date.now()}`
  });
  return NextResponse.json({ ...result, to: user.email, setup });
}
