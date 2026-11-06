// POST /api/account/phone
//   { action: 'send', phone }   save the number (un-verified) and text a code via Twilio Verify
//   { action: 'verify', code }  confirm the code -> phone verified
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { checkPhoneVerification, normalizeUsPhone, startPhoneVerification, verifyConfigured } from '@/lib/messaging';

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return err('Please sign in.', 401);
  if (!verifyConfigured()) return err('Phone verification isn’t available yet.', 503);

  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();

  if (body.action === 'send') {
    const phone = typeof body.phone === 'string' ? normalizeUsPhone(body.phone) : null;
    if (!phone) return err('Enter a 10-digit US mobile number.');
    // Saving a different number clears any earlier verification and consent (database trigger).
    await admin.from('profiles').update({ phone }).eq('id', user.id);
    try {
      await startPhoneVerification(phone);
    } catch (e: any) {
      console.error('Verify send failed', e);
      return err('We couldn’t text that number. Check it and try again in a minute.', 502);
    }
    return NextResponse.json({ ok: true, phone });
  }

  if (body.action === 'verify') {
    const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '').slice(0, 10) : '';
    if (code.length < 4) return err('Enter the code we texted you.');
    const { data: profile } = await admin.from('profiles').select('phone').eq('id', user.id).single();
    if (!profile?.phone) return err('Send yourself a code first.');
    const ok = await checkPhoneVerification(profile.phone, code).catch(() => false);
    if (!ok) return err('That code didn’t match or has expired. Send a new one.');
    await admin.from('profiles').update({ phone_verified_at: new Date().toISOString() }).eq('id', user.id).eq('phone', profile.phone);
    return NextResponse.json({ ok: true });
  }

  return err('Unknown action.');
}
