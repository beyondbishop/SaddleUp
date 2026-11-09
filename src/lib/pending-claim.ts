// Server-only: finish a claim the seller started on the claim page.
//
// Sellers usually open their claim link inside Facebook's in-app browser, sign up there, then
// confirm their email in a different browser (Mail/Gmail opens Chrome or Safari). That second
// browser can't finish the sign-in the first one started, so the "Claim" tap never happens.
// The claim page stores the claim token on the new account (user_metadata.claim_token), and
// whichever page they reach first once signed in with a confirmed email calls this to claim it.

import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';

/** Claims the listing in the user's pending claim token, if any. Returns its id when it claimed one. */
export async function claimPendingListing(user: User | null): Promise<string | null> {
  const token = user?.user_metadata?.claim_token;
  if (!user || typeof token !== 'string' || !token) return null;
  // Claiming needs a confirmed email, same as signing in.
  if (!user.email_confirmed_at) return null;

  const admin = createAdminClient();
  // Clear it first, so a failure (already claimed, removed) isn't retried on every page.
  await admin.auth.admin.updateUserById(user.id, { user_metadata: { claim_token: null } });

  const { data: t } = await admin.from('listing_claim_tokens').select('listing_id').eq('token', token).maybeSingle();
  if (!t) return null;
  // Same as the claim_listing database function: it becomes a draft for review, the link stops
  // working, and shoppers' conversations about it move to the seller.
  const { data: claimed, error } = await admin
    .from('listings')
    .update({ seller_id: user.id, status: 'draft', claimed_at: new Date().toISOString() })
    .eq('id', t.listing_id)
    .eq('status', 'unclaimed')
    .is('seller_id', null)
    .select('id')
    .maybeSingle();
  if (error || !claimed) {
    if (error) console.error('Pending claim failed', error.message);
    return null;
  }
  await admin.from('listing_claim_tokens').delete().eq('listing_id', claimed.id);
  await admin.from('conversations').update({ seller_id: user.id }).eq('listing_id', claimed.id).neq('buyer_id', user.id);
  return claimed.id;
}

export const claimedEditUrl = (id: string) => `/dashboard/listings/${id}/edit?claimed=1`;
