import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});

export const COMMISSION_PERCENT = Number(process.env.COMMISSION_PERCENT ?? 20);
export const COMMISSION_CAP_CENTS = Number(process.env.COMMISSION_CAP_CENTS ?? 50000);

// 20% commission, capped at $500 — mirrors calc_commission_cents() in schema.sql
export function calcCommissionCents(salePriceCents: number) {
  const pct = Math.round(salePriceCents * (COMMISSION_PERCENT / 100));
  return Math.min(pct, COMMISSION_CAP_CENTS);
}
