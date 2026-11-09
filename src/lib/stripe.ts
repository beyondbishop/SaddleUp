import Stripe from 'stripe';

// Trimmed (and unquoted): a key pasted into Vercel with a trailing newline or quotes is
// rejected by Stripe as "malformed".
export const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY ?? '').trim().replace(/^["']|["']$/g, '');

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20'
});

import { SELLER_FEE_CAP_DOLLARS, SELLER_FEE_PERCENT } from './fees';

// Set in src/lib/fees.ts (not env vars), so the fee charged always matches the fee we advertise.
export const COMMISSION_PERCENT = SELLER_FEE_PERCENT;
export const COMMISSION_CAP_CENTS = SELLER_FEE_CAP_DOLLARS * 100;

// Seller fee (5% during beta), capped at $500
export function calcCommissionCents(salePriceCents: number) {
  const pct = Math.round(salePriceCents * (COMMISSION_PERCENT / 100));
  return Math.min(pct, COMMISSION_CAP_CENTS);
}
