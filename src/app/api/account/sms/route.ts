// POST /api/account/sms { optIn: boolean, consent?: true }
// Turn order texts on (verified phone + explicit consent, recorded with its wording version) or off.
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { SMS_CONSENT_VERSION } from '@/lib/messaging';

export async function POST(req: Request) {
  const {
    data: { user }
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();

  if (body.optIn === true) {
    if (body.consent !== true) return NextResponse.json({ error: 'Please tick the box to agree to texts.' }, { status: 400 });
    const { data: p } = await admin.from('profiles').select('phone, phone_verified_at').eq('id', user.id).single();
    if (!p?.phone || !p.phone_verified_at) return NextResponse.json({ error: 'Verify your phone number first.' }, { status: 400 });
    await admin
      .from('profiles')
      .update({
        sms_opt_in_at: new Date().toISOString(),
        sms_opt_in_source: 'notification_settings',
        sms_consent_version: SMS_CONSENT_VERSION,
        sms_opt_out_at: null
      })
      .eq('id', user.id);
    return NextResponse.json({ ok: true, texts: 'on' });
  }

  if (body.optIn === false) {
    await admin.from('profiles').update({ sms_opt_in_at: null, sms_opt_out_at: new Date().toISOString() }).eq('id', user.id);
    return NextResponse.json({ ok: true, texts: 'off' });
  }

  return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
}
