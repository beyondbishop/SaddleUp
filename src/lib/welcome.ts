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

export async function sendWelcomeOnce(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    // Claim the welcome atomically: only the first caller gets the row back.
    const { data: profile } = await admin
      .from('profiles')
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq('id', userId)
      .is('welcome_sent_at', null)
      .select('email, full_name')
      .maybeSingle();
    if (!profile?.email) return;

    const { subject, html, text } = welcomeEmail(profile.full_name);
    const result = await sendEmail({ to: profile.email, from: WELCOME_FROM, subject, html, text, idempotencyKey: `welcome-${userId}` });
    if (result.status !== 'sent') {
      // Not sent (email not set up yet, or Resend failed): release the claim so it's tried next sign-in.
      await admin.from('profiles').update({ welcome_sent_at: null }).eq('id', userId);
      if (result.status === 'failed') console.error('Welcome email failed', userId, result.detail);
    }
  } catch (e) {
    console.error('Welcome email error', e);
  }
}
