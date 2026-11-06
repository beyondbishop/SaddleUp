// POST /api/twilio/inbound   Twilio calls this when someone replies to a SaddleUp text.
// STOP (and synonyms) turns texts off; START turns them back on. Twilio itself also blocks
// messages to anyone who replied STOP and answers HELP, so this keeps our records in step.
import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const STOP = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'REVOKE']);
const START = new Set(['START', 'UNSTOP', 'YES']);
const empty = () => new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });

/** Twilio's signature: HMAC-SHA1(auth token, full URL + sorted form params), base64. */
function signatureValid(url: string, params: URLSearchParams, signature: string | null) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const data = url + [...params.keys()].sort().map((k) => k + (params.get(k) ?? '')).join('');
  const expected = createHmac('sha1', token).update(data).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  // Twilio signs the public URL it called (behind Vercel's proxy, rebuild it from the site URL).
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me').replace(/\/$/, '');
  const url = `${site}${new URL(req.url).pathname}`;
  if (!signatureValid(url, params, req.headers.get('x-twilio-signature'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const from = params.get('From');
  const word = (params.get('Body') ?? '').trim().toUpperCase();
  if (!from) return empty();
  const admin = createAdminClient();

  if (STOP.has(word)) {
    await admin.from('profiles').update({ sms_opt_out_at: new Date().toISOString(), sms_opt_in_at: null }).eq('phone', from);
  } else if (START.has(word)) {
    // Only re-enable a verified number that had agreed before.
    await admin
      .from('profiles')
      .update({ sms_opt_out_at: null, sms_opt_in_at: new Date().toISOString(), sms_opt_in_source: 'reply_start' })
      .eq('phone', from)
      .not('phone_verified_at', 'is', null)
      .not('sms_consent_version', 'is', null);
  }
  return empty();
}
