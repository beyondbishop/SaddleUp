import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

// Called from the seller dashboard: "Set up payouts" button.
// Creates (or reuses) a Stripe Connect Express account for the seller and
// returns an onboarding link to redirect them to.
export async function POST() {
  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single();

  let accountId = profile?.stripe_connect_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } }
    });
    accountId = account.id;
    await admin.from('profiles').update({ stripe_connect_account_id: accountId }).eq('id', user.id);
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?connect=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?connect=complete`,
    type: 'account_onboarding'
  });

  return NextResponse.json({ url: accountLink.url });
}
