// GET /auth/google?next=/somewhere — starts "Continue with Google".
// Runs on the server so the sign-in handshake cookie is set reliably, then sends the person to
// Google. Google returns them to /auth/callback, which finishes signing in.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-next';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next'));

  const { data, error } = await createClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: 'select_account' }
    }
  });
  if (error || !data.url) {
    console.error('Google sign-in could not start', error);
    return NextResponse.redirect(new URL(`/auth/login?error=google&next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(data.url);
}
