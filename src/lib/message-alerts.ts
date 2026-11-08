// Alerts for new messages in a buyer <-> seller conversation: an email always, plus a text when the
// recipient has a verified phone and agreed to message texts (consent version MESSAGE_SMS_CONSENT_FROM or later).
// At most one alert per conversation per channel every THROTTLE_MIN minutes, so a back-and-forth chat
// doesn't flood anyone. Logged in notification_log (template 'new_message').
// Never throws: a failed alert must never block sending a message.
import { createAdminClient } from '@/lib/supabase/server';
import { MESSAGE_SMS_CONSENT_FROM, sendEmail, sendSms } from '@/lib/messaging';
import { deliver } from '@/lib/notify';
import { readPrefs } from '@/lib/notification-prefs';
import { emailLogo, emailSignature, TEXT_SIGNATURE, WELCOME_FROM } from '@/lib/welcome';

const RAW_SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me').replace(/\/$/, '');
const SITE = RAW_SITE.includes('localhost') ? 'https://saddleup.me' : RAW_SITE;
const THROTTLE_MIN = 30;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

type Info = {
  toSeller: boolean;
  firstMessage: boolean;
  recipientFirst: string | null;
  senderFirst: string;
  saddle: string;
  priceCents: number | null;
  image: string | null;
  body: string;
  url: string;
  textsOn: boolean;
};

export function buildMessageAlert(i: Info) {
  const hi = i.recipientFirst ? `Hi ${i.recipientFirst},` : 'Hi there,';
  const subject = i.toSeller
    ? i.firstMessage
      ? `${i.senderFirst} is interested in your ${i.saddle}`
      : `New message from ${i.senderFirst} about your ${i.saddle}`
    : `${i.senderFirst} replied about the ${i.saddle}`;
  const intro = i.toSeller
    ? i.firstMessage
      ? `Good news: ${i.senderFirst} just messaged you about your ${i.saddle}. Here’s what they said:`
      : `${i.senderFirst} sent you another message about your ${i.saddle}:`
    : `${i.senderFirst} replied to you about the ${i.saddle}:`;
  const after = i.toSeller
    ? 'Reply on SaddleUp so your conversation stays in one place. A quick answer makes a big difference: riders often message a few sellers at once.'
    : 'Reply on SaddleUp to keep the conversation going. When you’re ready, you can buy the saddle right from the listing, with a 5-day inspection after delivery.';
  const tip = i.toSeller
    ? 'Buyers mostly want to know about fit. If you can, send a photo of the gullet from the front and the panels from underneath, plus the tree width and how the saddle has been stored.'
    : 'Ask for a photo of the gullet from the front and the panels from underneath. They tell you more about fit than almost anything else.';
  const button = `Reply to ${i.senderFirst}`;
  const footer = `You’re getting this because someone messaged you on SaddleUp. To answer ${i.senderFirst}, use the button above: replying to this email reaches me, not them.`;
  const textsNudge = i.textsOn
    ? null
    : { html: `Want these by text so you never miss one? <a href="${SITE}/account/profile#notifications" style="color:#2f4a3a">Turn on text alerts</a>.`, text: `Want these by text so you never miss one? Turn on text alerts: ${SITE}/account/profile#notifications` };

  const p = (t: string, margin = '0 0 14px') => `<p style="font-size:15px;line-height:1.5;margin:${margin}">${t}</p>`;
  const quote = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 16px;width:100%"><tr>
    <td style="background:#fbf8f3;border:1px solid #e6dccf;border-radius:6px;padding:14px 16px;font-family:Georgia,serif;font-size:15px;line-height:1.5;color:#2b2118;white-space:pre-wrap">${esc(i.body)}</td>
  </tr></table>`;
  const card = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 4px;border:1px solid #e6dccf;border-radius:6px;width:100%"><tr>
    ${i.image ? `<td style="padding:10px;width:96px;vertical-align:middle"><img src="${esc(i.image)}" alt="" width="96" height="72" style="display:block;border:0;width:96px;height:72px;object-fit:cover;border-radius:4px"></td>` : ''}
    <td style="padding:10px;vertical-align:middle;font-family:Georgia,serif">
      <div style="font-size:16px;font-weight:bold;color:#2b2118">${esc(i.saddle)}</div>
      ${i.priceCents ? `<div style="font-size:14px;color:#5a3a22">${usd(i.priceCents)}</div>` : ''}
    </td>
  </tr></table>`;
  const tipBox = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 20px;width:100%"><tr>
    <td style="background:#f6f0e6;border-left:3px solid #2f4a3a;padding:12px 14px;font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#2b2118"><strong style="color:#2f4a3a">Pro tip:</strong> ${esc(tip)}</td>
  </tr></table>`;
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2b2118">
  ${emailLogo()}
  ${p(esc(hi))}
  ${p(esc(intro))}
  ${quote}
  ${card}
  <p style="margin:20px 0 24px"><a href="${i.url}" style="background:#2f4a3a;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">${esc(button)}</a></p>
  ${p(esc(after))}
  ${tipBox}
  ${textsNudge ? p(textsNudge.html) : ''}
  ${p('Happy riding,', '0 0 16px')}
  ${emailSignature()}
  <p style="font-size:12px;color:#7a6a5a;margin:24px 0 0">${esc(footer)}</p>
</div>`;
  const text = [
    hi,
    intro,
    i.body.split('\n').map((l) => `> ${l}`).join('\n'),
    `${i.saddle}${i.priceCents ? ` · ${usd(i.priceCents)}` : ''}`,
    `${button}: ${i.url}`,
    after,
    `Pro tip: ${tip}`,
    ...(textsNudge ? [textsNudge.text] : []),
    `Happy riding,\n\n${TEXT_SIGNATURE}`,
    footer
  ].join('\n\n');

  // Plain quotes keep the text in the cheaper GSM character set (curly ones double the segment count).
  const snippet = i.body.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, ' ').trim();
  const short = snippet.length > 90 ? `${snippet.slice(0, 87)}...` : snippet;
  const sms = i.toSeller
    ? `SaddleUp: ${i.senderFirst} messaged you about your ${i.saddle}: "${short}" Reply:`
    : `SaddleUp: ${i.senderFirst} replied about the ${i.saddle}: "${short}" Reply:`;

  return { subject, html, text, from: WELCOME_FROM, sms };
}

/** Sample alerts for the /admin/emails review page. */
export function previewMessageAlerts() {
  const base = {
    saddle: '17.5" CWD SE02',
    priceCents: 185000,
    image: null,
    url: 'https://saddleup.me/messages/sample',
    textsOn: false
  };
  return {
    toSeller: buildMessageAlert({
      ...base,
      toSeller: true,
      firstMessage: true,
      recipientFirst: 'Jane',
      senderFirst: 'Sam',
      body: 'Hi! Is this still available? What tree width is it, and has it been reflocked recently? My mare is a medium-wide warmblood.'
    }),
    toBuyer: buildMessageAlert({
      ...base,
      toSeller: false,
      firstMessage: false,
      recipientFirst: 'Sam',
      senderFirst: 'Jane',
      body: 'Yes, still available! It’s a 2A (medium-wide) and was reflocked in March. Happy to send more photos.'
    })
  };
}

const firstName = (full: string | null | undefined) => full?.trim().split(/\s+/)[0] || null;

/** Alert the other person in the conversation about this message. callerId must be the sender. */
export async function notifyNewMessage(messageId: string, callerId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: msg } = await admin.from('messages').select('id, conversation_id, sender_id, body, created_at').eq('id', messageId).maybeSingle();
    // Only the sender can trigger an alert, and only for a message they just sent.
    if (!msg || msg.sender_id !== callerId) return;
    if (Date.now() - new Date(msg.created_at).getTime() > 10 * 60_000) return;

    const { data: convo } = await admin.from('conversations').select('id, listing_id, buyer_id, seller_id').eq('id', msg.conversation_id).maybeSingle();
    if (!convo) return;
    const toSeller = msg.sender_id === convo.buyer_id;
    const recipientId = toSeller ? convo.seller_id : convo.buyer_id;
    if (!recipientId || recipientId === msg.sender_id) return;

    const [{ data: listing }, { data: people }, { count: earlier }] = await Promise.all([
      admin.from('listings').select('seat_size, model, price_cents, images, brands(name)').eq('id', convo.listing_id).maybeSingle(),
      admin
        .from('profiles')
        .select('id, email, full_name, phone, phone_verified_at, sms_opt_in_at, sms_opt_out_at, sms_consent_version')
        .in('id', [recipientId, msg.sender_id]),
      admin.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', convo.id).lt('created_at', msg.created_at)
    ]);
    const to: any = people?.find((p: any) => p.id === recipientId);
    const from: any = people?.find((p: any) => p.id === msg.sender_id);
    if (!to) return;

    const brand = (listing?.brands as { name?: string } | null)?.name;
    const saddle = listing
      ? `${listing.seat_size ? `${listing.seat_size}" ` : ''}${brand && brand !== 'Other' ? `${brand} ` : ''}${listing.model ?? 'saddle'}`.trim()
      : 'saddle';
    const images = (listing?.images as string[] | null) ?? [];
    const prefs = (await readPrefs(admin, [recipientId])).get(recipientId)!;
    const textsOn = !!(
      to.phone &&
      to.phone_verified_at &&
      to.sms_opt_in_at &&
      !to.sms_opt_out_at &&
      to.sms_consent_version &&
      to.sms_consent_version >= MESSAGE_SMS_CONSENT_FROM
    );
    const url = `${SITE}/messages/${convo.id}`;
    const alert = buildMessageAlert({
      toSeller,
      firstMessage: !earlier,
      recipientFirst: firstName(to.full_name),
      senderFirst: firstName(from?.full_name) ?? (toSeller ? 'A rider' : 'The seller'),
      saddle,
      priceCents: listing?.price_cents ?? null,
      image: images[0] && /^https:\/\//.test(images[0]) ? images[0] : null,
      body: msg.body.length > 1500 ? `${msg.body.slice(0, 1500)}…` : msg.body,
      url,
      textsOn: textsOn || !prefs.messages_sms // no "turn on texts" nudge for someone who turned message texts off
    });

    // Throttle: skip a channel if this person already got an alert for this conversation recently.
    const prefix = `msg:${convo.id}:${recipientId}:`;
    const since = new Date(Date.now() - THROTTLE_MIN * 60_000).toISOString();
    const { data: recent } = await admin
      .from('notification_log')
      .select('channel')
      .eq('template', 'new_message')
      .like('dedupe_key', `${prefix}%`)
      .in('status', ['pending', 'sent'])
      .gte('created_at', since);
    const recentlySent = new Set((recent ?? []).map((r: any) => r.channel));
    const base = { order_id: null, user_id: recipientId, template: 'new_message' };

    if (to.email && prefs.messages_email && !recentlySent.has('email')) {
      const key = `${prefix}${msg.id}:email`;
      await deliver(key, { ...base, channel: 'email' }, () =>
        sendEmail({ to: to.email, from: alert.from, subject: alert.subject, html: alert.html, text: alert.text, idempotencyKey: key })
      );
    }
    if (textsOn && prefs.messages_sms && !recentlySent.has('sms')) {
      const key = `${prefix}${msg.id}:sms`;
      await deliver(key, { ...base, channel: 'sms' }, () => sendSms({ to: to.phone, body: `${alert.sms} ${url}`.slice(0, 320) }));
    }
  } catch (e) {
    console.error('Message alert failed', messageId, e);
  }
}
