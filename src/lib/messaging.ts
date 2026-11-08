// Low-level senders. Each returns a result instead of throwing, and does nothing (status
// 'skipped') until its provider is configured, so missing setup never breaks an order.

export type SendResult = { status: 'sent' | 'failed' | 'skipped'; detail: string };

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** Texts go out only once Twilio is set up AND TWILIO_SMS_ENABLED=on (after carrier registration). */
export const smsConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_MESSAGING_SERVICE_SID) &&
  process.env.TWILIO_SMS_ENABLED === 'on';

export async function sendEmail(opts: { to: string; from?: string; subject: string; html: string; text: string; idempotencyKey: string }): Promise<SendResult> {
  if (!emailConfigured()) return { status: 'skipped', detail: 'email not configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': opts.idempotencyKey.slice(0, 256)
      },
      body: JSON.stringify({ from: opts.from ?? process.env.EMAIL_FROM, to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text })
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { status: 'sent', detail: json.id ?? '' } : { status: 'failed', detail: `${res.status} ${json.message ?? ''}`.trim() };
  } catch (e: any) {
    return { status: 'failed', detail: e?.message ?? 'network error' };
  }
}

const twilioAuth = () =>
  'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');

export async function sendSms(opts: { to: string; body: string }): Promise<SendResult> {
  if (!smsConfigured()) return { status: 'skipped', detail: 'texts not enabled' };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!, To: opts.to, Body: opts.body })
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { status: 'sent', detail: json.sid ?? '' } : { status: 'failed', detail: `${res.status} ${json.message ?? ''}`.trim() };
  } catch (e: any) {
    return { status: 'failed', detail: e?.message ?? 'network error' };
  }
}

// ---------- Phone verification (Twilio Verify sends the code, so it works before carrier registration) ----------

export const verifyConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);

export async function startPhoneVerification(phone: string) {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
    method: 'POST',
    headers: { Authorization: twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, Channel: 'sms' })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `Verify error ${res.status}`);
}

export async function checkPhoneVerification(phone: string, code: string) {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, {
    method: 'POST',
    headers: { Authorization: twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, Code: code })
  });
  const json = await res.json().catch(() => ({}));
  return res.ok && json.status === 'approved';
}

/** US numbers only for now: "(415) 555-0123" -> "+14155550123", else null. */
export function normalizeUsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? `+1${ten}` : null;
}

export const SMS_CONSENT_VERSION = '2026-11-08';
export const SMS_CONSENT_TEXT =
  'Text me updates about my SaddleUp orders (payment, shipping, delivery, inspection deadlines and payouts). ' +
  'Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.';
