// "Here's a link to sign in": sent when an admin taps "Email sign-in link" on the Users page,
// or when someone uses "Forgot password?" on the sign-in page.
// The link signs the person straight in and takes them to /account/password, where they can set
// a new password (or skip it if they use Google). It works once, and expires after the Supabase
// "Email OTP expiration" setting (1 hour by default).
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail, type SendResult } from '@/lib/messaging';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me').replace(/\/$/, '');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function loginLinkEmail(fullName: string | null, email: string, link: string) {
  const first = fullName?.trim().split(/\s+/)[0];
  const hi = first ? `Hi ${first},` : 'Hi there,';
  const subject = 'Your SaddleUp sign-in link';
  const paras = [
    `Here’s a link to sign in to SaddleUp as ${email}. Tap the button and you’re in. You can then set a new password if you’d like one.`,
    'The link works once and expires in 1 hour. If it has expired, use “Forgot password?” on the sign-in page to get a new one.'
  ];
  const after = 'If you didn’t ask for this, you can ignore this email. Your account is unchanged.';

  const p = (t: string) => `<p style="font-size:15px;line-height:1.5;margin:0 0 14px">${t}</p>`;
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2b2118">
  ${p(esc(hi))}
  ${paras.map((t) => p(esc(t))).join('\n  ')}
  <p style="margin:24px 0"><a href="${link}" style="background:#2f4a3a;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Sign in to SaddleUp</a></p>
  <p style="font-size:12px;color:#7a6a5a;margin:0 0 14px">Or paste this into your browser:<br><span style="word-break:break-all">${esc(link)}</span></p>
  ${p(esc(after))}
</div>`;
  const text = [hi, ...paras, `Sign in: ${link}`, after].join('\n\n');
  return { subject, html, text };
}

/** Creates a one-time sign-in link for this person and emails it to them. */
export async function sendLoginLink(userId: string): Promise<SendResult> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('email, full_name').eq('id', userId).maybeSingle();
  if (!profile?.email) return { status: 'failed', detail: 'This person has no email address.' };

  // A "recovery" link signs them in without their password. We build our own URL from the
  // hashed token so the session is set on our domain by /auth/confirm (no Supabase redirect).
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: profile.email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return { status: 'failed', detail: error?.message ?? 'Could not create a sign-in link.' };

  const link = `${SITE}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=recovery&next=${encodeURIComponent('/account/password')}`;
  const { subject, html, text } = loginLinkEmail(profile.full_name, profile.email, link);
  return sendEmail({ to: profile.email, subject, html, text, idempotencyKey: `login-link-${userId}-${hash.slice(0, 16)}` });
}
