// GET /auth/confirm?token_hash=...&type=recovery&next=/account/password
// Where emailed sign-in links land. Checks the one-time token with Supabase, which signs the
// person in on this site, then sends them on to `next`.
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-next';

const TYPES: EmailOtpType[] = ['recovery', 'magiclink', 'email', 'signup', 'invite', 'email_change'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get('next'));
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  if (token_hash && type && TYPES.includes(type)) {
    const { error } = await createClient().auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error('Email sign-in link failed', error.message);
  }
  return NextResponse.redirect(new URL(`/auth/login?error=link&next=${encodeURIComponent(next)}`, url.origin));
}
