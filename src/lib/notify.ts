// Order notifications: which order events message whom, and what they say.
// Called from logOrderEvent(), so every recorded event gets its messages, once each
// (notification_log.dedupe_key), by email always and by text when the person opted in.
// Never throws: a failed message must never block payments, shipping or payouts.
import { createAdminClient } from '@/lib/supabase/server';
import { formatDeadline } from '@/lib/order-rules';
import { sendEmail, sendSms, type SendResult } from '@/lib/messaging';
import { readPrefs } from '@/lib/notification-prefs';

type Role = 'buyer' | 'seller' | 'admin';
type Msg = { subject: string; lines: string[]; sms?: string };
type Ctx = { order: any; saddle: string; data: any; site: string };

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const link = (ctx: Ctx, role: Role) =>
  role === 'admin' ? `${ctx.site}/admin/orders` : role === 'seller' ? `${ctx.site}/sales/${ctx.order.id}` : `${ctx.site}/orders/${ctx.order.id}`;

/** event type -> message per recipient role. Missing role = that person isn't told. */
const TEMPLATES: Record<string, Partial<Record<Role, (c: Ctx) => Msg>>> = {
  paid: {
    buyer: (c) => ({
      subject: `Order confirmed: ${c.saddle}`,
      lines: [
        `Thanks for your order. You paid ${usd(c.order.sale_price_cents + (c.order.shipping_cents ?? 0))}${c.order.shipping_cents ? ` (including ${usd(c.order.shipping_cents)} shipping)` : ''}.`,
        `The seller ships by ${formatDeadline(c.order.dispatch_due_at)}. Your payment is held until you've had 5 days to inspect the saddle after delivery.`
      ],
      sms: `SaddleUp: Order confirmed for ${c.saddle}. Seller ships by ${formatDeadline(c.order.dispatch_due_at)}. Track it:`
    }),
    seller: (c) => ({
      subject: `You sold your ${c.saddle}`,
      lines: [
        `Your saddle sold for ${usd(c.order.sale_price_cents)}. Your payout will be ${usd(c.order.seller_payout_cents)}.`,
        `Please pack it carefully and ship by ${formatDeadline(c.order.dispatch_due_at)}. Create your prepaid shipping label from the sale page.`,
        `You're paid once the buyer keeps the saddle or their 5-day inspection after delivery ends.`
      ],
      sms: `SaddleUp: Your ${c.saddle} sold! Ship by ${formatDeadline(c.order.dispatch_due_at)}. Print your label:`
    })
  },
  shipped: {
    buyer: (c) => ({
      subject: `Your saddle is on its way`,
      lines: [
        `The carrier has your ${c.saddle}.${c.order.tracking_number ? ` Tracking: ${(c.order.carrier ?? '').toUpperCase()} ${c.order.tracking_number}.` : ''}`,
        `Someone will need to sign for it. Your 5-day inspection starts when it's delivered.`
      ],
      sms: `SaddleUp: Your ${c.saddle} has shipped${c.order.tracking_number ? ` (${(c.order.carrier ?? '').toUpperCase()} ${c.order.tracking_number})` : ''}. Details:`
    })
  },
  delivered: {
    buyer: (c) => ({
      subject: `Delivered: your 5-day inspection has started`,
      lines: [
        `Your ${c.saddle} was delivered. You have until ${formatDeadline(c.order.release_at)} to inspect it.`,
        `Happy with it? Choose "Keep this saddle". If something's wrong, request a return or report a problem before then. If you do nothing, the seller is paid when the inspection ends.`
      ],
      sms: `SaddleUp: Your ${c.saddle} was delivered. Inspect it by ${formatDeadline(c.order.release_at)}. Keep, return or report a problem:`
    }),
    seller: (c) => ({
      subject: `Delivered to the buyer`,
      lines: [`Your ${c.saddle} was delivered. The buyer has until ${formatDeadline(c.order.release_at)} to inspect it, then your payout is sent.`],
      sms: `SaddleUp: Your ${c.saddle} was delivered. Buyer inspection ends ${formatDeadline(c.order.release_at)}.`
    })
  },
  inspection_reminder_2d: {
    buyer: (c) => ({
      subject: `About 2 days left to inspect your saddle`,
      lines: [`Your inspection window for the ${c.saddle} ends ${formatDeadline(c.order.release_at)}. Keep it, or tell us if something's wrong before then.`],
      sms: `SaddleUp: About 2 days left to inspect your ${c.saddle} (ends ${formatDeadline(c.order.release_at)}).`
    })
  },
  inspection_reminder_1d: {
    buyer: (c) => ({
      subject: `Last day to inspect your saddle`,
      lines: [`Your inspection window for the ${c.saddle} ends ${formatDeadline(c.order.release_at)}. After that the seller is paid and returns aren't available through SaddleUp.`],
      sms: `SaddleUp: Last day to inspect your ${c.saddle}. Ends ${formatDeadline(c.order.release_at)}.`
    })
  },
  kept: {
    seller: (c) => ({
      subject: `The buyer is keeping your saddle`,
      lines: [`Good news: the buyer kept your ${c.saddle}. Your payout of ${usd(c.order.seller_payout_cents)} is on its way.`],
      sms: `SaddleUp: The buyer kept your ${c.saddle}. Your ${usd(c.order.seller_payout_cents)} payout is on its way.`
    })
  },
  inspection_expired: {
    buyer: (c) => ({
      subject: `Your inspection window has ended`,
      lines: [`The 5-day inspection for your ${c.saddle} has ended and the seller is being paid. Enjoy the saddle!`]
    })
    // The seller hears from "payout_sent" a moment later.
  },
  payout_sent: {
    seller: (c) => ({
      subject: `Payout sent: ${usd(c.order.seller_payout_cents)}`,
      lines: [`We've sent ${usd(c.order.seller_payout_cents)} for your ${c.saddle} to your Stripe account. It usually reaches your bank within a few business days.`],
      sms: `SaddleUp: ${usd(c.order.seller_payout_cents)} for your ${c.saddle} has been sent to your Stripe account.`
    })
  },
  payout_failed: {
    admin: (c) => ({ subject: `Payout failed: ${c.saddle}`, lines: [`A seller payout failed and will retry daily. Reason: ${c.data?.reason ?? 'unknown'}.`] })
  },
  return_requested: {
    buyer: (c) => ({
      subject: `We received your return request`,
      lines: [`Thanks for telling us about your ${c.saddle}. The seller's payout is paused and SaddleUp will contact you about next steps, usually within one business day.`]
    }),
    seller: (c) => ({
      subject: `The buyer requested a return`,
      lines: [`The buyer of your ${c.saddle} has requested a return. Your payout is paused while SaddleUp reviews it, and we'll contact you.`],
      sms: `SaddleUp: The buyer of your ${c.saddle} requested a return. Payout paused while we review.`
    }),
    admin: (c) => ({ subject: `Return requested: ${c.saddle}`, lines: [`Reason: ${c.data?.reason ?? ''}. Review it in Orders to review.`] })
  },
  problem_reported: {
    buyer: (c) => ({
      subject: `We received your report`,
      lines: [`Thanks for telling us about the problem with your ${c.saddle}. The seller's payout is paused and SaddleUp will contact you, usually within one business day.`]
    }),
    seller: (c) => ({
      subject: `The buyer reported a problem`,
      lines: [`The buyer of your ${c.saddle} reported a problem. Your payout is paused while SaddleUp reviews it, and we'll contact you.`],
      sms: `SaddleUp: The buyer of your ${c.saddle} reported a problem. Payout paused while we review.`
    }),
    admin: (c) => ({ subject: `Problem reported: ${c.saddle}`, lines: [`Reason: ${c.data?.reason ?? ''}. Review it in Orders to review.`] })
  },
  delivery_problem: {
    buyer: (c) => ({
      subject: `A delivery problem with your saddle`,
      lines: [`The carrier reported a problem delivering your ${c.saddle}. SaddleUp is looking into it and will be in touch. Your payment stays protected.`],
      sms: `SaddleUp: The carrier reported a delivery problem with your ${c.saddle}. We're on it.`
    }),
    seller: (c) => ({
      subject: `A delivery problem with your sale`,
      lines: [`The carrier reported a problem delivering your ${c.saddle}. SaddleUp is looking into it; your payout is paused meanwhile.`]
    }),
    admin: (c) => ({ subject: `Delivery problem: ${c.saddle}`, lines: [`Carrier status: ${c.data?.status ?? ''}. Review it in Orders to review.`] })
  },
  review_resolved: {
    buyer: (c) => ({ subject: `Update on your order`, lines: [`SaddleUp has finished reviewing your order for the ${c.saddle}. See the order page for details.`] }),
    seller: (c) => ({ subject: `Update on your sale`, lines: [`SaddleUp has finished reviewing the sale of your ${c.saddle}. Your payout follows the normal schedule again.`] })
  },
  dispatch_reminder: {
    seller: (c) => ({
      subject: `Reminder: ship by ${formatDeadline(c.order.dispatch_due_at)}`,
      lines: [`Please ship the ${c.saddle} by ${formatDeadline(c.order.dispatch_due_at)}. Your prepaid label is on the sale page.`],
      sms: `SaddleUp: Reminder to ship your ${c.saddle} by ${formatDeadline(c.order.dispatch_due_at)}. Label:`
    })
  },
  dispatch_overdue: {
    seller: (c) => ({
      subject: `Your sale is overdue to ship`,
      lines: [`The ${c.saddle} was due to ship by ${formatDeadline(c.order.dispatch_due_at)}. Please ship it today or contact SaddleUp. Orders that don't ship may be cancelled and refunded.`],
      sms: `SaddleUp: Your ${c.saddle} is overdue to ship. Please ship today or contact us.`
    }),
    admin: (c) => ({ subject: `Overdue to ship: ${c.saddle}`, lines: [`Was due ${formatDeadline(c.order.dispatch_due_at)}.`] })
  },
  refunded: {
    buyer: (c) => ({
      subject: `Your refund is on its way`,
      lines: [`We've refunded your order for the ${c.saddle}. It usually appears on your card within 5–10 business days.`]
    }),
    seller: (c) => ({ subject: `Order refunded`, lines: [`The order for your ${c.saddle} has been refunded to the buyer.`] })
  }
};

export const NOTIFIED_EVENTS = Object.keys(TEMPLATES);

function render(msg: Msg, url: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2b2118">
  <p style="font-size:20px;color:#5a3a22;margin:0 0 16px">SaddleUp</p>
  ${msg.lines.map((l) => `<p style="font-size:15px;line-height:1.5">${esc(l)}</p>`).join('\n  ')}
  <p style="margin:24px 0"><a href="${url}" style="background:#2f4a3a;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">View your order</a></p>
  <p style="font-size:12px;color:#7a6a5a">You're getting this because of an order on SaddleUp. Questions? Reply to this email.</p>
</div>`;
  const text = `${msg.lines.join('\n\n')}\n\nView your order: ${url}\n\nSaddleUp`;
  return { html, text };
}

/** Every order email rendered with a sample order, for the /admin/emails review page. */
export function previewOrderEmails() {
  const day = 864e5;
  const order = {
    id: 'sample',
    sale_price_cents: 185000,
    shipping_cents: 9500,
    seller_payout_cents: 166500,
    dispatch_due_at: new Date(Date.now() + 3 * day).toISOString(),
    release_at: new Date(Date.now() + 9 * day).toISOString(),
    tracking_number: '1Z999AA10123456784',
    carrier: 'ups'
  };
  const ctx: Ctx = { order, saddle: '17.5" CWD SE02', data: {}, site: 'https://saddleup.me' };
  const out: { event: string; role: Role; subject: string; html: string; text: string; sms?: string }[] = [];
  for (const [event, roles] of Object.entries(TEMPLATES)) {
    for (const role of ['buyer', 'seller', 'admin'] as Role[]) {
      const t = roles[role];
      if (!t) continue;
      const msg = t(ctx);
      out.push({ event, role, subject: msg.subject, sms: msg.sms, ...render(msg, link(ctx, role)) });
    }
  }
  return out;
}

export async function deliver(key: string, base: { order_id: string | null; user_id: string | null; channel: 'email' | 'sms'; template: string }, send: () => Promise<SendResult>) {
  const admin = createAdminClient();
  // Claim this message first; a duplicate event finds the row already there and stops.
  const { data: claimed } = await admin
    .from('notification_log')
    .upsert({ dedupe_key: key, ...base, status: 'pending' }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id');
  if (!claimed?.length) return;
  const result = await send();
  await admin.from('notification_log').update({ status: result.status, detail: result.detail.slice(0, 500) }).eq('dedupe_key', key);
}

/** Send the messages for one order event. Safe to call repeatedly for the same event. */
export async function notifyOrderEvent(orderId: string, type: string, data?: Record<string, unknown>) {
  const templates = TEMPLATES[type];
  if (!templates) return;
  try {
    const admin = createAdminClient();
    const { data: order } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!order) return;
    const snap = order.listing_snapshot ?? {};
    const saddle = `${snap.seat_size ?? ''}" ${snap.brands?.name && snap.brands.name !== 'Other' ? `${snap.brands.name} ` : ''}${snap.model ?? 'saddle'}`.trim();
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me').replace(/\/$/, '');
    const ctx: Ctx = { order, saddle, data: data ?? {}, site: site.includes('localhost') ? 'https://saddleup.me' : site };

    const people: { role: Role; id: string | null }[] = [];
    if (templates.buyer) people.push({ role: 'buyer', id: order.buyer_id });
    if (templates.seller) people.push({ role: 'seller', id: order.seller_id });
    const ids = people.map((p) => p.id).filter(Boolean) as string[];
    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('id, email, phone, phone_verified_at, sms_opt_in_at, sms_opt_out_at').in('id', ids)
      : { data: [] as any[] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const prefsById = await readPrefs(admin, ids);
    if (templates.admin) {
      const { data: admins } = await admin.from('profiles').select('id, email').eq('is_admin', true);
      for (const a of admins ?? []) {
        people.push({ role: 'admin', id: a.id });
        byId.set(a.id, a);
      }
    }

    for (const { role, id } of people) {
      const p: any = id ? byId.get(id) : null;
      const make = templates[role];
      if (!p || !make) continue;
      const msg = make(ctx);
      const url = link(ctx, role);
      const base = { order_id: order.id, user_id: p.id, template: type };

      if (p.email) {
        const { html, text } = render(msg, url);
        const key = `${order.id}:${type}:${role}:${p.id}:email`;
        await deliver(key, { ...base, channel: 'email' }, () =>
          sendEmail({ to: p.email, subject: msg.subject, html, text, idempotencyKey: key })
        );
      }
      const smsOk = role !== 'admin' && prefsById.get(p.id)?.orders_sms !== false && msg.sms && p.phone && p.phone_verified_at && p.sms_opt_in_at && !p.sms_opt_out_at;
      if (smsOk) {
        const key = `${order.id}:${type}:${role}:${p.id}:sms`;
        await deliver(key, { ...base, channel: 'sms' }, () => sendSms({ to: p.phone, body: `${msg.sms} ${url}`.slice(0, 320) }));
      }
    }
  } catch (e) {
    console.error(`Notifications for ${type} on order ${orderId} failed`, e);
  }
}
