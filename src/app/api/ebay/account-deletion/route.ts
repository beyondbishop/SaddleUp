// eBay Marketplace Account Deletion notifications (required by eBay for production API keys).
// Register this URL in developer.ebay.com > Alerts & Notifications:
//   https://saddleup.me/api/ebay/account-deletion
// with the same verification token as EBAY_VERIFICATION_TOKEN (32–80 chars, letters/digits/_/-).
//
// When an eBay user deletes their account, we forget their eBay username on any imported listing.

import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ENDPOINT = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saddleup.me'}/api/ebay/account-deletion`;

// eBay's endpoint validation: respond with sha256(challengeCode + verificationToken + endpoint).
export async function GET(req: Request) {
  const challengeCode = new URL(req.url).searchParams.get('challenge_code');
  const token = process.env.EBAY_VERIFICATION_TOKEN;
  if (!challengeCode || !token) return NextResponse.json({ error: 'not configured' }, { status: 400 });

  const challengeResponse = createHash('sha256').update(challengeCode).update(token).update(ENDPOINT).digest('hex');
  return NextResponse.json({ challengeResponse });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    metadata?: { topic?: string };
    notification?: { data?: { username?: string } };
  } | null;

  const username = body?.notification?.data?.username;
  if (body?.metadata?.topic === 'MARKETPLACE_ACCOUNT_DELETION' && username) {
    const { error } = await createAdminClient()
      .from('listings')
      .update({ ebay_seller_username: null })
      .eq('ebay_seller_username', username);
    if (error) {
      console.error('eBay account deletion cleanup failed', error.message);
      return NextResponse.json({ ok: false }, { status: 500 }); // eBay retries on non-2xx
    }
  }
  return new NextResponse(null, { status: 204 });
}
