// GET /auth/callback?code=...&next=/somewhere — Google (via Supabase) sends people here after
// they pick their account. Swap the one-time code for a session, then continue to `next`.
// New Google users get a SaddleUp profile automatically (the on_auth_user_created trigger).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-next';
import { sendWelcomeOnce } from '@/lib/welcome';
import { welcomeUrl } from '@/lib/onboarding';
import { claimPendingListing, claimedEditUrl } from '@/lib/pending-claim';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');

  if (code) {
    const { data, error } = await createClient().auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await sendWelcomeOnce(data.user.id); // once per person; no-op after the first
      const claimedId = await claimPendingListing(data.user);
      if (claimedId) return NextResponse.redirect(new URL(claimedEditUrl(claimedId), url.origin));
      // Through /welcome: new members get the onboarding steps, everyone else passes straight on.
      return NextResponse.redirect(new URL(welcomeUrl(next), url.origin));
    }
    console.error('Google sign-in could not finish', error);
  }
  return NextResponse.redirect(new URL(`/auth/login?error=google&next=${encodeURIComponent(next)}`, url.origin));
}
