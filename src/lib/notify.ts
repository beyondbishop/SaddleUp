// Order notifications: which order events message whom, and what they say.
// Called from logOrderEvent(), so every recorded event gets its messages, once each
// (notification_log.dedupe_key), by email always and by text when the person opted in.
// Never throws: a failed message must never block payments, shipping or payouts.
import { createAdminClient } from '@/lib/supabase/server';
import { formatDeadline } from '@/lib/order-rules';
import { sendEmail, sendSms, type SendResult } from '@/lib/messaging';
import { readPrefs } from '@/lib/notification-prefs';
import { emailLogo, emailSignature, TEXT_SIGNATURE, WELCOME_FROM } from '@/lib/welcome';
import { timelineHtml, timelineText } from '@/lib/email-timeline';

type Role = 'buyer' | 'seller' | 'admin';
type Msg = { subject: string; lines: string[]; sms?: string; personal?: Personal };
type Ctx = { order: any; saddle: string; data: any; site: string; firstName?: string | null; transitDays?: number };

/**
 * The personal style (like the welcome email) used for every buyer and seller order email:
 * logo, a hello by first name, the sale timeline with where they are and what each step means,
 * a pro tip where one helps, and Danielle's signature. Sent from her address so replies reach
 * her. Admin alerts stay short and plain.
 */
type Personal = {
  /** Which timeline step they're on (0–4; 5 = all done). Leave out for emails without the timeline. */
  current?: number;
  button?: string;
  tip?: string;
  closing: string;
  /** Ask them to rate the sale: five star links to /review/<order>?rating=n. */
  rate?: { title: string; body: string };
};

const isPickupOrder = (c: Ctx) => c.order?.fulfillment === 'pickup';
/** "Ocala, FL" from the saddle as sold, for pickup messages. */
const pickupPlace = (c: Ctx) => {
  const s = c.order?.listing_snapshot ?? {};
  return [s.location_city, s.location_state].filter(Boolean).join(', ');
};
/** The buyer's contact details for a pickup order, for the seller's emails. */
const buyerContactLine = (c: Ctx) => {
  const t = c.order?.ship_to ?? {};
  const bits = [t.name, t.phone, t.email].filter(Boolean);
  return bits.length ? `The buyer: ${bits.join(', ')}.` : 'The buyer’s contact details are on your sale page.';
};

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const link = (ctx: Ctx, role: Role) =>
  role === 'admin' ? `${ctx.site}/admin/orders` : role === 'seller' ? `${ctx.site}/sales/${ctx.order.id}` : `${ctx.site}/orders/${ctx.order.id}`;

const BUYER_FOOTER = 'You’re getting this because you bought a saddle on SaddleUp. Questions? Just hit reply. It comes straight to me.';
const SELLER_FOOTER = 'You’re getting this because you sold a saddle on SaddleUp. Questions? Just hit reply. It comes straight to me.';

/**
 * What each part of the sale means, in order, for under the timeline. Same five steps as the bar.
 * Steps already done are told in the past tense with their dates; the rest say what will happen.
 */
function stepNotes(c: Ctx, role: 'buyer' | 'seller', current: number): [string, string][] {
  const o = c.order;
  const days = c.transitDays ?? 5;
  const ret = o.shipping_cents ? ` (about ${usd(o.shipping_cents)})` : '';
  const day = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : '';
  const pick = (i: number, done: string, todo: string) => (i < current ? done : todo);
  if (isPickupOrder(c)) {
    const where = pickupPlace(c);
    return role === 'seller'
      ? [
          ['Sold', pick(0, `The buyer paid on ${day(o.created_at)}.${current < 4 ? ' SaddleUp is holding the money safely until the sale is final.' : ''}`, 'The buyer has paid. SaddleUp holds the money safely until the sale is final.')],
          ['Arrange pickup', pick(1, 'You arranged the pickup. Thank you!', `The buyer is collecting it in person. Get in touch to agree a time, and hand it over by ${formatDeadline(o.dispatch_due_at)}.`)],
          ['Picked up', pick(2, `The buyer collected it${o.delivered_at ? ` on ${day(o.delivered_at)}` : ''}.`, 'When they have it, tap “I’ve handed it over” on your sale page (or they’ll confirm it).')],
          ['5-day trial', pick(3, 'The buyer’s trial is over and the sale is final.', `The buyer has 5 days from pickup to try the saddle on their horse${o.release_at ? `, until ${formatDeadline(o.release_at)}` : ''}.`)],
          ['You’re paid', pick(4, `${usd(o.seller_payout_cents)} has been sent to your Stripe account.`, `Once they keep it, or the 5 days end, I send ${usd(o.seller_payout_cents)} to your Stripe account. It usually reaches your bank within a few business days.`)]
        ]
      : [
          ['Ordered', pick(0, `You paid on ${day(o.created_at)}.${current < 4 ? ' SaddleUp is holding your payment safely until the sale is final.' : ''}`, 'You’ve paid, and SaddleUp holds your payment safely. The seller isn’t paid until the sale is final.')],
          ['Arrange pickup', pick(1, 'The pickup was arranged.', `You’re collecting it${where ? ` in ${where}` : ''}. The seller will contact you to agree a time, by ${formatDeadline(o.dispatch_due_at)}.`)],
          ['Picked up', pick(2, `You collected it${o.delivered_at ? ` on ${day(o.delivered_at)}` : ''}.`, 'When you have it, tap “I’ve picked it up” on your order (or the seller will). Your trial starts then.')],
          ['5-day trial', pick(3, 'Your trial is over.', `You have 5 days to try it on your horse${o.release_at ? `, until ${formatDeadline(o.release_at)}` : ''}. Keep it, or request a return. If you return it, you bring it back to the seller unless it isn’t as described.`)],
          ['It’s yours', pick(4, 'The sale is final. Enjoy your saddle!', 'Once you keep it, or the 5 days end, the sale is final and the seller is paid.')]
        ];
  }
  return role === 'seller'
    ? [
        ['Sold', pick(0, `The buyer paid on ${day(o.created_at)}.${current < 4 ? ' SaddleUp is holding the money safely until the sale is final.' : ''}`, 'The buyer has paid. SaddleUp holds the money safely until the sale is final.')],
        [current > 1 ? 'Shipped' : 'Ship it', pick(1, `You shipped it${o.shipped_at ? ` on ${day(o.shipped_at)}` : ''}. Thank you!`, `Pack the saddle and ship it by ${formatDeadline(o.dispatch_due_at)}. Your prepaid, insured shipping label is on your sale page: print it, tape it to the box and drop it off with the carrier.`)],
        ['Delivered', pick(2, `It arrived${o.delivered_at ? ` on ${day(o.delivered_at)}` : ''}.`, `The buyer signs for it, usually about ${days} days after you ship. I’ll email you when it arrives.`)],
        ['5-day trial', pick(3, 'The buyer’s trial is over and the sale is final.', `The buyer has 5 days from delivery to try the saddle on their horse${o.release_at ? `, until ${formatDeadline(o.release_at)}` : ''}.`)],
        ['You’re paid', pick(4, `${usd(o.seller_payout_cents)} has been sent to your Stripe account.`, `Once they keep it, or the 5 days end, I send ${usd(o.seller_payout_cents)} to your Stripe account. It usually reaches your bank within a few business days.`)]
      ]
    : [
        ['Ordered', pick(0, `You paid on ${day(o.created_at)}.${current < 4 ? ' SaddleUp is holding your payment safely until the sale is final.' : ''}`, 'You’ve paid, and SaddleUp holds your payment safely. The seller isn’t paid until the sale is final.')],
        ['Shipped', pick(1, `The seller shipped it${o.shipped_at ? ` on ${day(o.shipped_at)}` : ''}.`, `The seller ships by ${formatDeadline(o.dispatch_due_at)}. I’ll email you the tracking number as soon as it’s on its way.`)],
        ['Delivered', pick(2, `It was delivered${o.delivered_at ? ` on ${day(o.delivered_at)}` : ''}.`, `Someone signs for it, usually about ${days} days after it ships. Your trial starts when the carrier confirms delivery.`)],
        ['5-day trial', pick(3, 'Your trial is over.', `You have 5 days to try it on your horse${o.release_at ? `, until ${formatDeadline(o.release_at)}` : ''}. Keep it, or request a return. If you send it back, you pay return shipping${ret}, unless it isn’t as described.`)],
        ['It’s yours', pick(4, 'The sale is final. Enjoy your saddle!', 'Once you keep it, or the 5 days end, the sale is final and the seller is paid.')]
      ];
}

/** event type -> message per recipient role. Missing role = that person isn't told. */
const TEMPLATES: Record<string, Partial<Record<Role, (c: Ctx) => Msg | null>>> = {
  paid: {
    buyer: (c) => isPickupOrder(c) ? ({
      subject: `🎉 Order confirmed: your ${c.saddle}`,
      lines: [
        `Congratulations on your new saddle! Your order for the ${c.saddle} is confirmed. You paid ${usd(c.order.sale_price_cents)}, and you chose local pickup${pickupPlace(c) ? ` in ${pickupPlace(c)}` : ''}, so there’s no shipping charge.`,
        `The seller will contact you to arrange a time, by ${formatDeadline(c.order.dispatch_due_at)}. Here’s how the whole purchase works from here, and where you are now:`
      ],
      sms: `SaddleUp: Order confirmed for ${c.saddle} (local pickup). The seller will contact you to arrange it. Details:`,
      personal: {
        current: 1,
        button: 'View your order',
        tip: 'Bring a saddle cover or an old blanket and a girth to try it on your horse, and look it over carefully before you drive away. Take a few photos at pickup too.',
        closing: 'Thank you for buying on SaddleUp. I hope it’s the one.'
      }
    }) : ({
      subject: `🎉 Order confirmed: your ${c.saddle}`,
      lines: [
        `Congratulations on your new saddle! Your order for the ${c.saddle} is confirmed. You paid ${usd(c.order.sale_price_cents + (c.order.shipping_cents ?? 0))}${c.order.shipping_cents ? `, including ${usd(c.order.shipping_cents)} for insured shipping` : ''}.`,
        `The seller ships it by ${formatDeadline(c.order.dispatch_due_at)}. Here’s how the whole purchase works from here, and where you are now:`
      ],
      sms: `SaddleUp: Order confirmed for ${c.saddle}. Seller ships by ${formatDeadline(c.order.dispatch_due_at)}. Track it:`,
      personal: {
        current: 1,
        button: 'View your order',
        tip: 'Before it arrives, have a thin, plain pad ready and plan to check the fit on your horse’s bare back first, then ride. Take photos from the side and from behind. They make it easy to get a second opinion from your trainer or fitter during the trial.',
        closing: 'Thank you for buying on SaddleUp. I hope it’s the one.'
      }
    }),
    seller: (c) => isPickupOrder(c) ? ({
      subject: `🎉 Your ${c.saddle} sold! (local pickup)`,
      lines: [
        `Congratulations, your ${c.saddle} just sold! The buyer paid ${usd(c.order.sale_price_cents)}, and after SaddleUp’s fee you’ll receive ${usd(c.order.seller_payout_cents)}.`,
        `They chose local pickup, so there’s nothing to ship. Please contact them to arrange a time and hand it over by ${formatDeadline(c.order.dispatch_due_at)}. ${buyerContactLine(c)}`,
        'Here’s how the whole sale works from here, and where you are now:'
      ],
      sms: `SaddleUp: Your ${c.saddle} sold (local pickup)! Contact the buyer to arrange it by ${formatDeadline(c.order.dispatch_due_at)}:`,
      personal: {
        current: 1,
        button: 'See the buyer’s details',
        tip: 'Meet somewhere you’re comfortable, like your barn. Once they have it, tap “I’ve handed it over” on your sale page so their trial (and your payout clock) starts.',
        closing: 'Thank you for selling on SaddleUp. I hope it’s the perfect fit for its new horse.'
      }
    }) : ({
      subject: `🎉 Your ${c.saddle} sold!`,
      lines: [
        `Congratulations, your ${c.saddle} just sold! The buyer paid ${usd(c.order.sale_price_cents)}, and after SaddleUp’s fee you’ll receive ${usd(c.order.seller_payout_cents)}.`,
        `Your next step is to ship it by ${formatDeadline(c.order.dispatch_due_at)}. Here’s how the whole sale works from here, and where you are now:`
      ],
      sms: `SaddleUp: Your ${c.saddle} sold! Ship by ${formatDeadline(c.order.dispatch_due_at)}. Print your label:`,
      personal: {
        current: 1,
        button: 'Print your shipping label',
        tip: 'Stuff the gullet with a towel, wrap the saddle in a clean blanket or bag, and pad every side of the box. Take a few photos of it packed before you seal it. If anything happens in transit, those photos make the insurance claim quick.',
        closing: 'Thank you for selling on SaddleUp. I hope it’s the perfect fit for its new horse.'
      }
    })
  },
  dispatch_reminder: {
    seller: (c) => isPickupOrder(c) ? ({
      subject: `Reminder: please hand over your ${c.saddle} by ${formatDeadline(c.order.dispatch_due_at)}`,
      lines: [
        `Just a friendly reminder that the buyer is collecting your ${c.saddle} in person, and the handover is due by ${formatDeadline(c.order.dispatch_due_at)}. ${buyerContactLine(c)}`,
        'Once they have it, tap “I’ve handed it over” on your sale page. Here’s where the sale is now:'
      ],
      sms: `SaddleUp: Reminder to hand over your ${c.saddle} to the buyer by ${formatDeadline(c.order.dispatch_due_at)}:`,
      personal: { current: 1, button: 'View your sale', closing: 'Thanks for getting it to its new home.' }
    }) : ({
      subject: `Reminder: please ship your ${c.saddle} by ${formatDeadline(c.order.dispatch_due_at)}`,
      lines: [
        `Just a friendly reminder that your ${c.saddle} needs to ship by ${formatDeadline(c.order.dispatch_due_at)}. The buyer is excited to try it!`,
        'Your prepaid, insured label is waiting on your sale page. Here’s where the sale is now:'
      ],
      sms: `SaddleUp: Reminder to ship your ${c.saddle} by ${formatDeadline(c.order.dispatch_due_at)}. Label:`,
      personal: {
        current: 1,
        button: 'Print your shipping label',
        tip: 'If you’re reusing a box, cover or remove every old label and barcode, and tape the new label flat on the largest side. That way the carrier scans the right one.',
        closing: 'Thanks for getting it out the door.'
      }
    })
  },
  dispatch_overdue: {
    seller: (c) => isPickupOrder(c) ? ({
      subject: `Your ${c.saddle} pickup is overdue`,
      lines: [
        `The buyer was due to collect your ${c.saddle} by ${formatDeadline(c.order.dispatch_due_at)}, and it hasn’t been marked as handed over yet.`,
        'If they have it, tap “I’ve handed it over” on your sale page. If you can’t reach them, just reply and I’ll help.'
      ],
      sms: `SaddleUp: The pickup of your ${c.saddle} is overdue. Mark it handed over or contact us:`,
      personal: { current: 1, button: 'View your sale', closing: 'If something’s come up, just reply. I’m happy to help.' }
    }) : ({
      subject: `Your ${c.saddle} is overdue to ship`,
      lines: [
        `Your ${c.saddle} was due to ship by ${formatDeadline(c.order.dispatch_due_at)}, and I haven’t seen it with the carrier yet.`,
        'Please ship it today, or reply and let me know what’s going on. If a sale doesn’t ship, I may need to cancel it and refund the buyer.'
      ],
      sms: `SaddleUp: Your ${c.saddle} is overdue to ship. Please ship today or contact us.`,
      personal: { current: 1, button: 'Print your shipping label', closing: 'If something’s come up, just reply. I’m happy to help.' }
    }),
    admin: (c) => ({ subject: `Overdue to ${isPickupOrder(c) ? 'hand over (pickup)' : 'ship'}: ${c.saddle}`, lines: [`Was due ${formatDeadline(c.order.dispatch_due_at)}.`] })
  },
  shipped: {
    buyer: (c) => ({
      subject: `Your ${c.saddle} has shipped!`,
      lines: [
        `Good news: your ${c.saddle} is with the carrier.${c.order.tracking_number ? ` Tracking: ${(c.order.carrier ?? '').toUpperCase()} ${c.order.tracking_number}.` : ''}`,
        'Someone will need to sign for it. Your 5-day trial starts when the carrier confirms delivery. Here’s where you are now:'
      ],
      sms: `SaddleUp: Your ${c.saddle} has shipped${c.order.tracking_number ? ` (${(c.order.carrier ?? '').toUpperCase()} ${c.order.tracking_number})` : ''}. Details:`,
      personal: {
        current: 2,
        button: 'Track your saddle',
        tip: 'If you won’t be home to sign, use the carrier’s app to hold the package at a nearby location or pick a different day. A saddle sitting at the depot is much better than one sent back.',
        closing: 'Almost there!'
      }
    })
  },
  picked_up: {
    buyer: (c) => ({
      subject: `You have your ${c.saddle}: your 5-day trial starts now`,
      lines: [
        `Your ${c.saddle} has been handed over. Your 5-day trial runs until ${formatDeadline(c.order.release_at)}.`,
        'Happy with it? Tap “Keep this saddle” on your order. If it doesn’t fit, request a return before the trial ends. If you do nothing, the sale becomes final when the trial ends. Here’s where you are now:'
      ],
      sms: `SaddleUp: You have your ${c.saddle}. Your 5-day trial ends ${formatDeadline(c.order.release_at)}. Keep, return or report a problem:`,
      personal: {
        current: 3,
        button: 'Keep it or request a return',
        tip: 'Check the fit before you ride: saddle on a bare back, girth loose. Look for even contact along the panels and two to three fingers of clearance at the withers.',
        closing: 'Enjoy trying it. I hope it’s a perfect fit.'
      }
    }),
    seller: (c) => ({
      subject: `Your ${c.saddle} was picked up`,
      lines: [
        `Your ${c.saddle} is with its buyer. They now have 5 days to try it, until ${formatDeadline(c.order.release_at)}.`,
        `When they keep it, or the trial ends, I’ll send your ${usd(c.order.seller_payout_cents)}. Here’s where the sale is now:`
      ],
      sms: `SaddleUp: Your ${c.saddle} was picked up. The buyer's trial ends ${formatDeadline(c.order.release_at)}.`,
      personal: {
        current: 3,
        button: 'View your sale',
        tip: 'Now is a good time to check that the bank account on your Stripe payout account is right, so nothing holds up your payout.',
        closing: 'Nearly done. Thank you for your patience.'
      }
    })
  },
  delivered: {
    buyer: (c) => ({
      subject: `Your ${c.saddle} has arrived: your 5-day trial starts now`,
      lines: [
        `Your ${c.saddle} was delivered. Your 5-day trial runs until ${formatDeadline(c.order.release_at)}.`,
        'Happy with it? Tap “Keep this saddle” on your order. If it doesn’t fit, request a return before the trial ends. If you do nothing, the sale becomes final when the trial ends. Here’s where you are now:'
      ],
      sms: `SaddleUp: Your ${c.saddle} was delivered. Your 5-day trial ends ${formatDeadline(c.order.release_at)}. Keep, return or report a problem:`,
      personal: {
        current: 3,
        button: 'Keep it or request a return',
        tip: 'Check the fit before you ride: saddle on a bare back, girth loose. Look for even contact along the panels and two to three fingers of clearance at the withers. Keep all the packaging until you’re sure. You’ll need it if you send the saddle back.',
        closing: 'Enjoy trying it. I hope it’s a perfect fit.'
      }
    }),
    seller: (c) => ({
      subject: `Your ${c.saddle} was delivered`,
      lines: [
        `Your ${c.saddle} has arrived safely. The buyer now has 5 days to try it, until ${formatDeadline(c.order.release_at)}.`,
        `When they keep it, or the trial ends, I’ll send your ${usd(c.order.seller_payout_cents)}. Here’s where the sale is now:`
      ],
      sms: `SaddleUp: Your ${c.saddle} was delivered. The buyer's trial ends ${formatDeadline(c.order.release_at)}.`,
      personal: {
        current: 3,
        button: 'View your sale',
        tip: 'Now is a good time to check that the bank account on your Stripe payout account is right, so nothing holds up your payout.',
        closing: 'Nearly done. Thank you for your patience.'
      }
    })
  },
  inspection_reminder_2d: {
    buyer: (c) => ({
      subject: `About 2 days left in your saddle trial`,
      lines: [`Just a heads-up: your trial of the ${c.saddle} ends ${formatDeadline(c.order.release_at)}. If you love it, tap “Keep this saddle”. If it isn’t right, request a return before then.`],
      sms: `SaddleUp: About 2 days left in your trial of the ${c.saddle} (ends ${formatDeadline(c.order.release_at)}).`,
      personal: {
        current: 3,
        button: 'Keep it or request a return',
        tip: 'Not sure yet? Ride in it on two different days, and ask your trainer or saddle fitter to take a look. A saddle can feel different on a horse that’s fresh compared with one that’s been worked.',
        closing: 'Take your time. You still have a couple of days.'
      }
    })
  },
  inspection_reminder_1d: {
    buyer: (c) => ({
      subject: `Last day of your saddle trial`,
      lines: [`Today is the last day of your trial of the ${c.saddle}. It ends ${formatDeadline(c.order.release_at)}. After that the sale is final and returns aren’t available through SaddleUp.`],
      sms: `SaddleUp: Last day of your trial of the ${c.saddle}. Ends ${formatDeadline(c.order.release_at)}.`,
      personal: {
        current: 3,
        button: 'Keep it or request a return',
        tip: 'Love it? Tapping “Keep this saddle” lets the seller get paid today instead of waiting for the trial to run out. They’ll really appreciate it.',
        closing: 'Whatever you decide, I’m glad you tried it.'
      }
    })
  },
  kept: {
    buyer: (c) => ({
      subject: `🎉 The ${c.saddle} is yours!`,
      lines: [`Thank you for letting me know you’re keeping the ${c.saddle}. It’s officially yours, and the seller is being paid. I hope you have many happy rides in it.`],
      personal: {
        current: 5,
        button: 'View your order',
        rate: {
          title: 'How did we do?',
          body: 'Tap a star to rate the saddle, the seller and buying on SaddleUp. It takes a minute, and it really helps other riders.'
        },
        tip: 'Give it a gentle clean and condition before your first big ride. Have the flocking checked after a few weeks, once it has settled to your horse.',
        closing: 'Thank you for buying on SaddleUp.'
      }
    }),
    // Usually the payout goes out the moment the buyer keeps the saddle, and "payout_sent" tells
    // the seller both things in one email. This one only goes if the payout is still pending.
    seller: (c) => c.order.payout_status === 'transferred' ? null : ({
      subject: `🎉 The buyer is keeping your ${c.saddle}`,
      lines: [`Great news: the buyer loves your ${c.saddle} and is keeping it. Your payout of ${usd(c.order.seller_payout_cents)} is on its way.`],
      sms: `SaddleUp: The buyer kept your ${c.saddle}. Your ${usd(c.order.seller_payout_cents)} payout is on its way.`,
      personal: {
        current: 4,
        button: 'View your sale',
        tip: 'Have another saddle sitting in the tack room? Listing it takes about five minutes, and buyers on SaddleUp are looking for the right fit.',
        closing: 'Congratulations on a great sale.'
      }
    })
  },
  inspection_expired: {
    buyer: (c) => ({
      subject: `Your ${c.saddle} is officially yours`,
      lines: [`Your 5-day trial has ended, so the ${c.saddle} is officially yours and the seller is being paid. Enjoy it!`],
      personal: {
        current: 5,
        button: 'View your order',
        rate: {
          title: 'How did we do?',
          body: 'Tap a star to rate the saddle, the seller and buying on SaddleUp. It takes a minute, and it really helps other riders.'
        },
        tip: 'Give it a gentle clean and condition before your first big ride. Have the flocking checked after a few weeks, once it has settled to your horse.',
        closing: 'Thank you for buying on SaddleUp. Happy riding with your new saddle!'
      }
    })
    // The seller hears from "payout_sent" a moment later.
  },
  payout_sent: {
    seller: (c) => ({
      subject: c.order.confirmed_at
        ? `🎉 The buyer is keeping your ${c.saddle}, and you’ve been paid`
        : `💸 Your ${usd(c.order.seller_payout_cents)} payout is on its way`,
      lines: [
        ...(c.order.confirmed_at ? [`Great news: the buyer loves your ${c.saddle} and is keeping it.`] : []),
        `I’ve sent ${usd(c.order.seller_payout_cents)} for your ${c.saddle} to your Stripe account. It usually reaches your bank within a few business days. That’s the sale complete!`
      ],
      sms: `SaddleUp: ${usd(c.order.seller_payout_cents)} for your ${c.saddle} has been sent to your Stripe account.`,
      personal: {
        current: 5,
        button: 'View your sale',
        rate: {
          title: 'How was selling on SaddleUp?',
          body: 'Tap a star to rate your experience. I read every review, and it helps me make selling easier.'
        },
        tip: 'Know a rider with a saddle that doesn’t fit? Send them SaddleUp. Every saddle that finds the right horse makes the whole community better.',
        closing: 'Thank you for selling with SaddleUp.'
      }
    })
  },
  payout_failed: {
    admin: (c) => ({ subject: `Payout failed: ${c.saddle}`, lines: [`A seller payout failed and will retry daily. Reason: ${c.data?.reason ?? 'unknown'}.`] })
  },
  return_requested: {
    buyer: (c) => ({
      subject: `I’ve got your return request`,
      lines: [
        `Thanks for letting me know about your ${c.saddle}. I’m sorry it wasn’t the right one.`,
        `The seller’s payout is paused, and I’ll be in touch about next steps, usually within one business day. You pay return shipping${c.order.shipping_cents ? ` (about ${usd(c.order.shipping_cents)})` : ''}, unless the saddle isn’t as described.`
      ],
      personal: {
        button: 'View your order',
        tip: 'Keep the saddle clean and dry, and pack it the way it arrived. Take a few photos before you seal the box.',
        closing: 'We’ll find you the right one.'
      }
    }),
    seller: (c) => ({
      subject: `The buyer asked to return your ${c.saddle}`,
      lines: [
        `The buyer of your ${c.saddle} has asked to return it. Your payout is paused while I review it, and I’ll be in touch, usually within one business day.`,
        'This happens sometimes. Fit is personal, and it doesn’t mean anything is wrong with your saddle.'
      ],
      sms: `SaddleUp: The buyer of your ${c.saddle} requested a return. Payout paused while we review.`,
      personal: { button: 'View your sale', closing: 'I’ll keep you posted.' }
    }),
    admin: (c) => ({ subject: `Return requested: ${c.saddle}`, lines: [`Reason: ${c.data?.reason ?? ''}. Review it in Orders to review.`] })
  },
  problem_reported: {
    buyer: (c) => ({
      subject: `I’ve got your report`,
      lines: [`Thanks for telling me about the problem with your ${c.saddle}. The seller’s payout is paused, and I’ll be in touch, usually within one business day.`],
      personal: {
        button: 'View your order',
        tip: 'If anything is damaged, take clear photos of the saddle and the box before you move anything. They help a lot with the carrier’s insurance.',
        closing: 'I’m sorry about this. We’ll sort it out.'
      }
    }),
    seller: (c) => ({
      subject: `The buyer reported a problem with your ${c.saddle}`,
      lines: [`The buyer of your ${c.saddle} reported a problem. Your payout is paused while I look into it, and I’ll be in touch, usually within one business day.`],
      sms: `SaddleUp: The buyer of your ${c.saddle} reported a problem. Payout paused while we review.`,
      personal: { button: 'View your sale', closing: 'I’ll keep you posted.' }
    }),
    admin: (c) => ({ subject: `Problem reported: ${c.saddle}`, lines: [`Reason: ${c.data?.reason ?? ''}. Review it in Orders to review.`] })
  },
  delivery_problem: {
    buyer: (c) => ({
      subject: `A delivery problem with your ${c.saddle}`,
      lines: [`The carrier reported a problem delivering your ${c.saddle}. I’m looking into it and will be in touch. Your payment stays protected the whole time.`],
      sms: `SaddleUp: The carrier reported a delivery problem with your ${c.saddle}. We're on it.`,
      personal: { current: 2, button: 'View your order', closing: 'Sorry for the hiccup. I’m on it.' }
    }),
    seller: (c) => ({
      subject: `A delivery problem with your ${c.saddle}`,
      lines: [`The carrier reported a problem delivering your ${c.saddle}. I’m looking into it. Your payout is paused for now.`],
      personal: { current: 2, button: 'View your sale', closing: 'I’ll keep you posted.' }
    }),
    admin: (c) => ({ subject: `Delivery problem: ${c.saddle}`, lines: [`Carrier status: ${c.data?.status ?? ''}. Review it in Orders to review.`] })
  },
  review_resolved: {
    buyer: (c) => ({
      subject: `An update on your ${c.saddle}`,
      lines: [`I’ve finished reviewing your order for the ${c.saddle}. You’ll find the details on your order page.`],
      personal: { button: 'View your order', closing: 'Thank you for your patience.' }
    }),
    seller: (c) => ({
      subject: `An update on your ${c.saddle}`,
      lines: [`I’ve finished reviewing the sale of your ${c.saddle}. Your payout follows the normal schedule again.`],
      personal: { button: 'View your sale', closing: 'Thank you for your patience.' }
    })
  },
  refunded: {
    buyer: (c) => ({
      subject: `Your refund is on its way`,
      lines: [`I’ve refunded your order for the ${c.saddle}. It usually shows up on your card within 5 to 10 business days.`],
      personal: {
        tip: 'Save a search with your seat size and tree width, and I’ll email you the moment a saddle that fits is listed.',
        closing: 'I hope we find you the right one soon.'
      }
    }),
    seller: (c) => ({
      subject: `The order for your ${c.saddle} was refunded`,
      lines: [`The order for your ${c.saddle} has been refunded to the buyer. If the saddle is coming back to you, I’ll help you get it listed again.`],
      personal: { button: 'View your sale', closing: 'Just reply if you have any questions.' }
    })
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

const reviewUrl = (ctx: Ctx) => `${ctx.site}/review/${ctx.order.id}`;

/** "How did we do?" with five big stars; each opens the rating page with that many stars picked. */
function rateBlock(rate: { title: string; body: string }, base: string, esc: (s: string) => string) {
  const stars = [1, 2, 3, 4, 5]
    .map((n) => `<a href="${base}?rating=${n}" title="${n} star${n > 1 ? 's' : ''}" style="color:#d99a2b;text-decoration:none;font-size:34px;line-height:1;padding:0 3px">&#9733;</a>`)
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:4px 0 20px;width:100%"><tr>
    <td style="background:#fffaf0;border:1px solid #ecd9b0;border-radius:6px;padding:16px;text-align:center;font-family:Georgia,serif;color:#2b2118">
      <div style="font-size:17px;font-weight:bold;margin-bottom:4px">${esc(rate.title)}</div>
      <div style="font-size:14px;line-height:1.5;margin-bottom:8px">${esc(rate.body)}</div>
      <div>${stars}</div>
    </td>
  </tr></table>`;
}

function renderPersonal(msg: Msg, ctx: Ctx, role: Role, url: string) {
  const pers = msg.personal!;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hi = ctx.firstName ? `Hi ${ctx.firstName},` : 'Hi there,';
  const tRole = role === 'seller' ? 'seller' : 'buyer';
  const footer = role === 'seller' ? SELLER_FOOTER : BUYER_FOOTER;
  const hasTimeline = pers.current !== undefined;
  const cur = pers.current ?? -1;
  const notes = hasTimeline ? stepNotes(ctx, tRole, cur) : [];
  const p = (t: string, margin = '0 0 14px') => `<p style="font-size:15px;line-height:1.5;margin:${margin}">${t}</p>`;
  const steps = notes
    .map(([title, body], i) => {
      const here = i === cur;
      return `<tr>
      <td style="vertical-align:top;padding:0 10px 10px 0;width:26px"><div style="width:22px;height:22px;line-height:22px;border-radius:11px;text-align:center;font-size:12px;font-weight:bold;font-family:Georgia,serif;${
        i < cur ? 'background:#2f4a3a;color:#fff' : here ? 'background:#b8742a;color:#fff' : 'background:#f1e9dd;color:#8a7b6b'
      }">${i < cur ? '✓' : i + 1}</div></td>
      <td style="vertical-align:top;padding:0 0 10px;font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#2b2118">
        <strong style="color:${here ? '#b8742a' : '#2b2118'}">${esc(title)}${here ? ' (you are here)' : ''}</strong><br>${esc(body)}
      </td>
    </tr>`;
    })
    .join('');
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2b2118">
  ${emailLogo()}
  ${p(esc(hi))}
  ${msg.lines.map((l) => p(esc(l))).join('\n  ')}
  ${hasTimeline ? timelineHtml(ctx.order, tRole, { transitDays: ctx.transitDays, current: cur }) : ''}
  ${steps ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 8px;width:100%">${steps}</table>` : ''}
  ${pers.rate ? rateBlock(pers.rate, reviewUrl(ctx), esc) : ''}
  <p style="margin:8px 0 24px"><a href="${url}" style="background:#2f4a3a;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">${esc(pers.button ?? (role === 'seller' ? 'View your sale' : 'View your order'))}</a></p>
  ${pers.tip ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 20px;width:100%"><tr>
    <td style="background:#f6f0e6;border-left:3px solid #2f4a3a;padding:12px 14px;font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#2b2118"><strong style="color:#2f4a3a">Pro tip:</strong> ${esc(pers.tip)}</td>
  </tr></table>` : ''}
  ${p(esc(pers.closing))}
  ${p('Happy riding,', '0 0 16px')}
  ${emailSignature()}
  <p style="font-size:12px;color:#7a6a5a;margin:24px 0 0">${esc(footer)}</p>
</div>`;
  const text = [
    hi,
    ...msg.lines,
    ...(hasTimeline
      ? [
          timelineText(ctx.order, tRole, { transitDays: ctx.transitDays, current: cur }),
          notes.map(([t, b], i) => `${i + 1}. ${t}${i === cur ? ' (you are here)' : ''}: ${b}`).join('\n')
        ]
      : []),
    ...(pers.rate ? [`${pers.rate.title} ${pers.rate.body}\nRate it: ${reviewUrl(ctx)}`] : []),
    `${pers.button ?? (role === 'seller' ? 'View your sale' : 'View your order')}: ${url}`,
    ...(pers.tip ? [`Pro tip: ${pers.tip}`] : []),
    pers.closing,
    `Happy riding,\n\n${TEXT_SIGNATURE}`,
    footer
  ].join('\n\n');
  return { html, text, from: WELCOME_FROM };
}

/** Pick the email layout: the personal one where a template has been written for it, else the plain one. */
function renderFor(msg: Msg, ctx: Ctx, role: Role, url: string): { html: string; text: string; from?: string } {
  return msg.personal ? renderPersonal(msg, ctx, role, url) : render(msg, url);
}

/** A made-up order sold today, for previews and test sends. */
/** How far along the sample order is when each email goes out, so previews show real-looking dates. */
const SAMPLE_STAGE: Record<string, number> = {
  shipped: 2, delivery_problem: 2,
  delivered: 3, picked_up: 3, inspection_reminder_2d: 3, inspection_reminder_1d: 3, return_requested: 3, problem_reported: 3, review_resolved: 3,
  kept: 4, inspection_expired: 4, payout_sent: 5, refunded: 3
};

/** A made-up order at the right stage for `event` (sold 2 days before it ships, etc.), for previews and test sends. */
function sampleCtx(event = 'paid'): Ctx {
  const day = 864e5;
  const stage = SAMPLE_STAGE[event] ?? 1;
  const now = Date.now();
  // Work back from "now" so the email's own moment is today.
  const delivered = stage >= 3 ? now - (event === 'inspection_reminder_2d' ? 3 : event === 'inspection_reminder_1d' ? 4 : stage >= 4 ? 5 : 0) * day : null;
  const shipped = stage >= 2 ? (delivered ?? now) - (stage >= 3 ? 4 : 0) * day : null;
  const created = (shipped ?? now) - (shipped ? 2 : 0) * day;
  const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());
  const order = {
    id: 'sample',
    created_at: iso(created),
    sale_price_cents: 185000,
    shipping_cents: 9500,
    seller_payout_cents: 166500,
    dispatch_due_at: iso(created + 3 * day),
    shipped_at: iso(shipped),
    delivered_at: iso(delivered),
    release_at: iso(delivered === null ? null : delivered + 5 * day),
    kept_at: event === 'kept' ? iso(now) : null,
    // Preview the usual case: the buyer tapped Keep, so the payout email says so too.
    confirmed_at: event === 'payout_sent' ? iso(now) : null,
    payout_status: stage >= 5 ? 'transferred' : 'held',
    tracking_number: '1Z999AA10123456784',
    carrier: 'ups'
  };
  return { order, saddle: '17.5" CWD SE02', data: {}, site: 'https://saddleup.me', firstName: 'Jane', transitDays: 4 };
}

/** Every order email rendered with a sample order, for the /admin/emails review page. */
export function previewOrderEmails() {
  const out: { event: string; role: Role; subject: string; html: string; text: string; sms?: string; from?: string }[] = [];
  for (const [event, roles] of Object.entries(TEMPLATES)) {
    const ctx = sampleCtx(event);
    for (const role of ['buyer', 'seller', 'admin'] as Role[]) {
      const t = roles[role];
      if (!t) continue;
      const msg = t(ctx);
      if (!msg) continue;
      out.push({ event, role, subject: msg.subject, sms: msg.sms, ...renderFor(msg, ctx, role, link(ctx, role)) });
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
    if (order.shipping_quote_id) {
      const { data: quote } = await admin.from('shipping_quotes').select('estimated_days').eq('id', order.shipping_quote_id).maybeSingle();
      if (quote?.estimated_days) ctx.transitDays = quote.estimated_days;
    }

    const people: { role: Role; id: string | null }[] = [];
    if (templates.buyer) people.push({ role: 'buyer', id: order.buyer_id });
    if (templates.seller) people.push({ role: 'seller', id: order.seller_id });
    const ids = people.map((p) => p.id).filter(Boolean) as string[];
    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('id, email, full_name, phone, phone_verified_at, sms_opt_in_at, sms_opt_out_at').in('id', ids)
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
      const msg = make({ ...ctx, firstName: p.full_name?.trim().split(/\s+/)[0] ?? null });
      if (!msg) continue;
      const url = link(ctx, role);
      const base = { order_id: order.id, user_id: p.id, template: type };

      if (p.email) {
        const { html, text, from } = renderFor(msg, { ...ctx, firstName: p.full_name?.trim().split(/\s+/)[0] ?? null }, role, url);
        const key = `${order.id}:${type}:${role}:${p.id}:email`;
        await deliver(key, { ...base, channel: 'email' }, () =>
          sendEmail({ to: p.email, ...(from ? { from } : {}), subject: msg.subject, html, text, idempotencyKey: key })
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

/** One order email with the sample order (sold today) and the admin's first name, for "Send me a test". */
export function orderEmailForTest(type: string, role: Role, firstName: string | null) {
  const make = TEMPLATES[type]?.[role];
  if (!make) return null;
  const ctx: Ctx = { ...sampleCtx(type), firstName };
  const msg = make(ctx);
  if (!msg) return null;
  return { subject: msg.subject, ...renderFor(msg, ctx, role, link(ctx, role)) };
}
