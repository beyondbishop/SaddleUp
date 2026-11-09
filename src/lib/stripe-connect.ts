// Seller payout accounts on Stripe Accounts v2.
//
// Stripe no longer lets new Connect platforms create v1 accounts (stripe.accounts.create), and
// stripe-node v16 has no v2 methods, so these calls go to the v2 REST API directly.
//
// Sellers get a "recipient" configuration: they only receive transfers from SaddleUp (buyers pay
// SaddleUp, which pays the seller by /v1/transfers after inspection). SaddleUp is responsible
// for Stripe fees and negative balances, as it was with the old Express accounts. Stripe hosts
// onboarding and identity checks.
import { createAdminClient } from '@/lib/supabase/server';

const STRIPE_V2_VERSION = '2026-10-28.endive';

/** A failed Stripe v2 call, keeping Stripe's HTTP status and error code for callers to act on. */
export class StripeV2Error extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function v2<T = any>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': STRIPE_V2_VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  const json = await res.json();
  if (!res.ok) {
    throw new StripeV2Error(
      `Stripe ${method} ${path} failed (${res.status}${json?.error?.code ? ` ${json.error.code}` : ''}): ${json?.error?.message ?? 'no message'}`,
      res.status,
      json?.error?.code
    );
  }
  return json as T;
}

export async function createSellerAccount(opts: { email?: string | null; name?: string | null; userId: string }) {
  const account = await v2('POST', '/v2/core/accounts', {
    contact_email: opts.email ?? undefined,
    display_name: opts.name ?? undefined,
    identity: { country: 'us', entity_type: 'individual' },
    configuration: {
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } }
    },
    dashboard: 'express',
    defaults: { responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
    metadata: { saddleup_user_id: opts.userId }
  });
  return account.id as string;
}

export async function createOnboardingLink(accountId: string, returnPath = '/dashboard') {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const link = await v2('POST', '/v2/core/account_links', {
    account: accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        refresh_url: `${site}${returnPath}?connect=refresh`,
        return_url: `${site}${returnPath}?connect=complete`
      }
    }
  });
  return link.url as string;
}

/**
 * True when Stripe doesn't know this account ID under the current key, e.g. an ID saved while the
 * site ran on a test key, now looked up with the live key (test and live accounts are separate).
 */
export function isMissingAccount(e: unknown) {
  if (!(e instanceof StripeV2Error)) return false;
  // Stripe v2 answers an unknown account ID with 403 "does not have permission to access account".
  return (
    e.status === 404 ||
    e.code === 'resource_missing' ||
    (e.status === 403 && /permission to access account/i.test(e.message))
  );
}

/** True once Stripe will accept transfers to this seller. */
export async function canReceiveTransfers(accountId: string) {
  const account = await v2('GET', `/v2/core/accounts/${accountId}?include=configuration.recipient`);
  return account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === 'active';
}

/**
 * Re-check a seller's payout status with Stripe and save it. Used when the seller returns from
 * onboarding, on their dashboard, and at checkout, so readiness never depends on a webhook alone.
 */
export async function refreshSellerPayoutStatus(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_onboarded')
    .eq('id', userId)
    .single();
  if (!profile?.stripe_connect_account_id) return false;

  let ready: boolean;
  try {
    ready = await canReceiveTransfers(profile.stripe_connect_account_id);
  } catch (e) {
    console.error('Could not check seller payout status', e);
    return !!profile.stripe_connect_onboarded;
  }
  if (ready !== !!profile.stripe_connect_onboarded) {
    await admin.from('profiles').update({ stripe_connect_onboarded: ready }).eq('id', userId);
  }
  return ready;
}
