// Seller emails about their own listing:
//   - "submitted": right after they add a saddle. Says where it stands (in review, or live) with a link.
//   - "live": when SaddleUp approves it and it goes on the site, with the link to the public listing.
// Written in Danielle's voice and sent from her address, like the welcome email, so replies reach her.
// Never throws: a failed email must never block saving or approving a listing.
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/messaging';
import { readPrefs } from '@/lib/notification-prefs';
import { emailLogo, emailSignature, TEXT_SIGNATURE, WELCOME_FROM } from '@/lib/welcome';

const RAW_SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me').replace(/\/$/, '');
const SITE = RAW_SITE.includes('localhost') ? 'https://saddleup.me' : RAW_SITE;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export type ListingEmailKind = 'submitted' | 'live';
type Info = { firstName: string | null; saddle: string; priceCents: number | null; url: string; image: string | null; status: string };

function build(kind: ListingEmailKind, info: Info) {
  const hi = info.firstName ? `Hi ${info.firstName},` : 'Hi there,';
  const live = kind === 'live' || info.status === 'active';
  const subject = live ? `Your ${info.saddle} is live on SaddleUp 🎉` : `Got it! Your ${info.saddle} is in review`;
  const paras = live
    ? [
        kind === 'live'
          ? `Great news: I’ve had a look at your ${info.saddle} and it’s now live on SaddleUp. Riders can find it, message you and buy it.`
          : `Your ${info.saddle} is now live on SaddleUp. Riders can find it, message you and buy it.`,
        'When someone messages you, I’ll let you know right away. When it sells, we handle the payment and you get a prepaid shipping label, so there’s nothing to chase.'
      ]
    : [
        `Thank you for listing your ${info.saddle} on SaddleUp. It’s been added, and I’m taking a look at it now.`,
        'I check every saddle before it goes on the site, usually within one business day. I’ll email you the moment it’s live. Until then, only you can see it.'
      ];
  const tip = live
    ? 'Share your listing link with your barn friends, your trainer and your local tack swap group. A lot of saddles end up with a friend of a friend.'
    : 'Listings with clear photos sell faster. If you can, add a shot of the gullet from the front, the panels from underneath, and the seat from the side. You can add photos while I review.';
  const button = live ? 'See your saddle live' : 'See your listing';
  const closing = live ? 'Fingers crossed it finds its perfect horse soon.' : 'Thanks again for trusting SaddleUp with your saddle.';
  const footer = 'You’re getting this because you listed a saddle on SaddleUp. Just hit reply if you have a question. It comes straight to me.';

  const p = (t: string, margin = '0 0 14px') => `<p style="font-size:15px;line-height:1.5;margin:${margin}">${t}</p>`;
  const card = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 4px;border:1px solid #e6dccf;border-radius:6px;width:100%"><tr>
    ${info.image ? `<td style="padding:10px;width:96px;vertical-align:middle"><img src="${esc(info.image)}" alt="" width="96" height="72" style="display:block;border:0;width:96px;height:72px;object-fit:cover;border-radius:4px"></td>` : ''}
    <td style="padding:10px;vertical-align:middle;font-family:Georgia,serif">
      <div style="font-size:16px;font-weight:bold;color:#2b2118">${esc(info.saddle)}</div>
      ${info.priceCents ? `<div style="font-size:14px;color:#5a3a22">${usd(info.priceCents)}</div>` : ''}
      <div style="font-size:12px;color:#7a6a5a;margin-top:2px">${live ? 'Live on SaddleUp' : 'In review'}</div>
    </td>
  </tr></table>`;
  const tipBox = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 20px;width:100%"><tr>
    <td style="background:#f6f0e6;border-left:3px solid #2f4a3a;padding:12px 14px;font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#2b2118"><strong style="color:#2f4a3a">Pro tip:</strong> ${esc(tip)}</td>
  </tr></table>`;
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2b2118">
  ${emailLogo()}
  ${p(esc(hi))}
  ${paras.map((t) => p(esc(t))).join('\n  ')}
  ${card}
  <p style="margin:20px 0 24px"><a href="${info.url}" style="background:#2f4a3a;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">${button}</a></p>
  ${tipBox}
  ${p(esc(closing))}
  ${p('Happy riding,', '0 0 16px')}
  ${emailSignature()}
  <p style="font-size:12px;color:#7a6a5a;margin:24px 0 0">${esc(footer)}</p>
</div>`;
  const text = [
    hi,
    ...paras,
    `${info.saddle}${info.priceCents ? ` · ${usd(info.priceCents)}` : ''} · ${live ? 'Live' : 'In review'}`,
    `${button}: ${info.url}`,
    `Pro tip: ${tip}`,
    closing,
    `Happy riding,\n\n${TEXT_SIGNATURE}`,
    footer
  ].join('\n\n');
  return { subject, html, text, from: WELCOME_FROM };
}

/** Both listing emails with a sample saddle, for the /admin/emails review page. */
export function previewListingEmails() {
  const sample: Info = {
    firstName: 'Jane',
    saddle: '17.5" CWD SE02',
    priceCents: 185000,
    url: 'https://saddleup.me/saddles/17-5-cwd-se02-abc12',
    image: null,
    status: 'draft'
  };
  return {
    submitted: build('submitted', sample),
    live: build('live', { ...sample, status: 'active' })
  };
}

/** Email the seller about their listing. Safe to call more than once: Resend drops repeats of the same key. */
export async function sendListingEmail(listingId: string, kind: ListingEmailKind): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: listing } = await admin
      .from('listings')
      .select('id, slug, status, seller_id, seat_size, model, price_cents, images, brands(name)')
      .eq('id', listingId)
      .maybeSingle();
    if (!listing?.seller_id || !listing.slug) return; // unclaimed imports have no seller to tell
    const { data: profile } = await admin.from('profiles').select('email, full_name').eq('id', listing.seller_id).maybeSingle();
    if (!profile?.email) return;
    if (!(await readPrefs(admin, [listing.seller_id])).get(listing.seller_id)?.listings_email) return;

    const brand = (listing.brands as { name?: string } | null)?.name;
    const saddle = `${listing.seat_size ? `${listing.seat_size}" ` : ''}${brand && brand !== 'Other' ? `${brand} ` : ''}${listing.model ?? 'saddle'}`.trim();
    const images = (listing.images as string[] | null) ?? [];
    const { subject, html, text, from } = build(kind, {
      firstName: profile.full_name?.trim().split(/\s+/)[0] ?? null,
      saddle,
      priceCents: listing.price_cents,
      url: `${SITE}/saddles/${listing.slug}`,
      image: images[0] && /^https:\/\//.test(images[0]) ? images[0] : null,
      status: listing.status
    });
    const result = await sendEmail({ to: profile.email, from, subject, html, text, idempotencyKey: `listing-${kind}-${listing.id}` });
    if (result.status === 'failed') console.error(`Listing ${kind} email failed`, listingId, result.detail);
  } catch (e) {
    console.error(`Listing ${kind} email error`, listingId, e);
  }
}
