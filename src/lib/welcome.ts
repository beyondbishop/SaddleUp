// The one welcome email new members get: "you're in, here's what you can do".
// sendWelcomeOnce() is called on every way into an account (email sign-up, sign-in, Google and
// email-confirmation links). profiles.welcome_sent_at makes sure it goes out exactly once.
// Never throws: a failed email must never block signing in.
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/messaging';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me').replace(/\/$/, '');

// Images load from the live site, so new ones show in emails once deployed.
const IMG = 'https://saddleup.me/images';
/** Shown under Danielle's name in the signature. */
const CONTACT_EMAIL = 'danielle@saddleup.me';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Shared by every email so they all look like they come from Danielle: logo on top, her headshot at the bottom.
/** SaddleUp logo, linked to the site. Goes first in every email. */
export const emailLogo = () =>
  `<p style="margin:0 0 20px"><a href="${SITE}"><img src="${IMG}/logo.png" alt="SaddleUp" width="140" height="53" style="display:block;border:0;width:140px;height:53px"></a></p>`;

/** Danielle's sign-off with her headshot. */
export const emailSignature = () => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>
    <td style="padding:0 14px 0 0;vertical-align:middle"><img src="${IMG}/danielle-headshot.jpg" alt="Danielle Bishop" width="88" height="88" style="display:block;border:0;width:88px;height:88px;border-radius:50%"></td>
    <td style="vertical-align:middle;font-family:Georgia,serif;line-height:1.4">
      <div style="font-size:16px;color:#2b2118;font-weight:bold">Danielle Bishop</div>
      <div style="font-size:13px;color:#7a6a5a">Founder, SaddleUp</div>
      <div style="font-size:13px"><a href="mailto:${CONTACT_EMAIL}" style="color:#2f4a3a">${CONTACT_EMAIL}</a></div>
    </td>
  </tr></table>`;

/** Plain-text version of the sign-off. */
export const TEXT_SIGNATURE = `Danielle Bishop\nFounder, SaddleUp\n${CONTACT_EMAIL}`;

// Written in Danielle's own voice and sent from danielle@saddleup.me, so replies (feedback) reach her.
export function welcomeEmail(fullName: string | null) {
  const first = fullName?.trim().split(/\s+/)[0];
  const hi = first ? `Hi ${first},` : 'Hi there,';
  const subject = 'Welcome to SaddleUp, you’re in';
  const paras = [
    'I’m Danielle Bishop, the founder of SaddleUp. Thank you for joining. Your account is all set.',
    'I started SaddleUp after a custom saddle I had made for my horse, Lionel, turned out not to fit him. I wanted a place where riders can find a good used saddle that fits their horse, without the hassle.',
    'Here’s what you can do now:'
  ];
  const things: [string, string, string][] = [
    ['Browse saddles', 'Search by brand, discipline, seat size and tree width. Every purchase comes with a 5-day inspection.', `${SITE}/saddles`],
    ['Save your favorites', 'Heart the saddles you like, or save a search and I’ll email you when a new one matches.', `${SITE}/lists`],
    ['Sell a saddle', 'List one from your dashboard. We help with pricing, shipping and getting paid.', `${SITE}/dashboard`]
  ];
  const feedback = [
    'We’re new and still growing, so thank you for being here early.',
    'I’d really like your feedback. What do you love, what is confusing or missing, what would make SaddleUp easier to use? Even a one-line reply helps. It comes straight to me, and I read every one.'
  ];

  const p = (t: string, margin = '0 0 14px') => `<p style="font-size:15px;line-height:1.5;margin:${margin}">${t}</p>`;
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2b2118">
  ${emailLogo()}
  ${p(esc(hi))}
  ${paras.map((t) => p(esc(t))).join('\n  ')}
  ${things
    .map(([title, body, url]) => p(`<a href="${url}" style="color:#2f4a3a;font-weight:bold">${esc(title)}</a><br>${esc(body)}`, '0 0 12px'))
    .join('\n  ')}
  <p style="margin:24px 0"><a href="${SITE}/saddles" style="background:#2f4a3a;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Start browsing</a></p>
  ${feedback.map((t) => p(esc(t))).join('\n  ')}
  ${p('Happy riding,', '0 0 16px')}
  ${emailSignature()}
  <p style="font-size:12px;color:#7a6a5a;margin:24px 0 0">You’re getting this one-time email because you created a SaddleUp account.</p>
</div>`;

  const text = [
    hi,
    ...paras,
    ...things.map(([title, body, url]) => `${title}: ${body}\n${url}`),
    ...feedback,
    `Happy riding,\n\n${TEXT_SIGNATURE}`
  ].join('\n\n');

  return { subject, html, text };
}

/** Sent from Danielle's own address; replies forward to her inbox. Needs saddleup.me verified in Resend. */
export const WELCOME_FROM = 'Danielle Bishop <danielle@saddleup.me>';

export type WelcomeResult = 'sent' | 'already_sent' | 'no_email' | 'skipped' | 'failed';

/**
 * Send the welcome email unless this person already had it. Safe to call from anywhere, any
 * number of times. A failure is recorded on the profile (welcome_last_error) and the claim is
 * released, so the next attempt (sign-in, or the daily catch-up) tries again.
 */
export async function sendWelcomeOnce(userId: string): Promise<WelcomeResult> {
  const admin = createAdminClient();
  try {
    // Claim the welcome atomically: only the first caller gets the row back.
    const { data: profile } = await admin
      .from('profiles')
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq('id', userId)
      .is('welcome_sent_at', null)
      .select('email, full_name')
      .maybeSingle();
    if (!profile) return 'already_sent';
    if (!profile.email) {
      await admin.from('profiles').update({ welcome_sent_at: null }).eq('id', userId);
      return 'no_email';
    }

    const { subject, html, text } = welcomeEmail(profile.full_name);
    const result = await sendEmail({ to: profile.email, from: WELCOME_FROM, subject, html, text, idempotencyKey: `welcome-${userId}` });
    if (result.status === 'sent') {
      await recordError(userId, null);
      return 'sent';
    }
    // Not sent (email not set up, or Resend refused it): release the claim and keep the reason.
    await admin.from('profiles').update({ welcome_sent_at: null }).eq('id', userId);
    await recordError(userId, `${result.status}: ${result.detail}`);
    console.error('Welcome email not sent', userId, result.status, result.detail);
    return result.status;
  } catch (e) {
    console.error('Welcome email error', e);
    await recordError(userId, `error: ${e instanceof Error ? e.message : String(e)}`);
    return 'failed';
  }
}

async function recordError(userId: string, message: string | null) {
  // Column added by the 20261116 migration; ignore the error if it isn't there yet.
  await createAdminClient()
    .from('profiles')
    .update({ welcome_last_error: message ? message.slice(0, 500) : null })
    .eq('id', userId)
    .then(() => {}, () => {});
}

/** Daily catch-up: welcome anyone who confirmed in the last week but hasn't had it (e.g. a send failed). */
export async function sendMissedWelcomes(limit = 20): Promise<number> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data: pending } = await admin
    .from('profiles')
    .select('id')
    .is('welcome_sent_at', null)
    .gte('created_at', since)
    .limit(limit);
  let sent = 0;
  for (const p of pending ?? []) {
    const { data } = await admin.auth.admin.getUserById(p.id);
    if (!data?.user?.email_confirmed_at) continue; // not confirmed yet
    if ((await sendWelcomeOnce(p.id)) === 'sent') sent++;
  }
  return sent;
}
