import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createSellerAccount, createOnboardingLink, isMissingAccount } from '@/lib/stripe-connect';

// Called from the seller dashboard: "Set up payouts" button.
// Creates (or reuses) the seller's Stripe payout account and returns a Stripe-hosted
// onboarding link to redirect them to.
export async function POST() {
  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, stripe_connect_account_id')
      .eq('id', user.id)
      .single();

    let accountId = profile?.stripe_connect_account_id;
    if (!accountId) {
      accountId = await createSellerAccount({ email: user.email, name: profile?.full_name, userId: user.id });
      // Only set it if still empty, so a double click can't orphan a second account.
      const { data: saved } = await admin
        .from('profiles')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', user.id)
        .is('stripe_connect_account_id', null)
        .select('stripe_connect_account_id');
      if (!saved?.length) {
        const { data: current } = await admin
          .from('profiles')
          .select('stripe_connect_account_id')
          .eq('id', user.id)
          .single();
        accountId = current!.stripe_connect_account_id;
      }
    }

    try {
      return NextResponse.json({ url: await createOnboardingLink(accountId!) });
    } catch (e) {
      if (!isMissingAccount(e)) throw e;
      // The saved account isn't visible to this Stripe key (e.g. it was made in test mode and the
      // site now runs live). Make a fresh one, replacing only that stale ID.
      console.warn(`Stripe account ${accountId} not found for user ${user.id}; creating a new one`);
      const stale = accountId!;
      accountId = await createSellerAccount({ email: user.email, name: profile?.full_name, userId: user.id });
      await admin
        .from('profiles')
        .update({ stripe_connect_account_id: accountId, stripe_connect_onboarded: false })
        .eq('id', user.id)
        .eq('stripe_connect_account_id', stale);
      return NextResponse.json({ url: await createOnboardingLink(accountId) });
    }
  } catch (e) {
    console.error('Payout setup failed', e);
    return NextResponse.json({ error: 'Payout setup is unavailable right now. Please try again.' }, { status: 500 });
  }
}
