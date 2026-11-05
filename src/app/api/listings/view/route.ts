// POST /api/listings/view  { listingId: string, referrer?: string }
// Records one view of a live listing for the seller's stats. Never fails loudly: whatever goes
// wrong (bot, the seller themself, duplicate, table not created yet) it just returns 204.
//
// Privacy: no IP address or identity is stored. visitor_hash = sha256(ip + browser + date +
// secret) counts unique visitors per day without being able to identify anyone; it changes daily.

import { createHash } from 'crypto';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { classifyReferrer } from '@/lib/view-source';

export const dynamic = 'force-dynamic';

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|fetch|curl|wget|python|headless|lighthouse|monitor|pingdom/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEDUPE_MINUTES = 30;
const done = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  try {
    const ua = req.headers.get('user-agent') ?? '';
    if (!ua || BOT.test(ua)) return done();

    const body = (await req.json().catch(() => null)) as { listingId?: string; referrer?: string } | null;
    const listingId = body?.listingId;
    if (!listingId || !UUID.test(listingId)) return done();

    const admin = createAdminClient();
    const { data: listing } = await admin.from('listings').select('seller_id, status').eq('id', listingId).maybeSingle();
    if (!listing || listing.status !== 'active') return done();

    // Don't count sellers looking at their own listing.
    const {
      data: { user }
    } = await createClient().auth.getUser();
    if (user && user.id === listing.seller_id) return done();

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
    const day = new Date().toISOString().slice(0, 10);
    const secret = process.env.VIEW_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const visitorHash = createHash('sha256').update(`${ip}|${ua}|${day}|${secret}`).digest('hex');

    // One view per visitor per listing per half hour (refreshes and back-button don't inflate counts).
    const since = new Date(Date.now() - DEDUPE_MINUTES * 60_000).toISOString();
    const { count, error: dupError } = await admin
      .from('listing_views')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .eq('visitor_hash', visitorHash)
      .gte('viewed_at', since);
    if (dupError) return done(); // e.g. table not created yet
    if (count) return done();

    const site = new URL(req.url).hostname;
    const { source, referrerHost, searchFilters } = classifyReferrer(body?.referrer, ['saddleup.me', site]);
    const decode = (v: string | null) => {
      try {
        return v ? decodeURIComponent(v) : null;
      } catch {
        return v;
      }
    };

    const { error } = await admin.from('listing_views').insert({
      listing_id: listingId,
      visitor_hash: visitorHash,
      signed_in: !!user,
      source,
      referrer_host: referrerHost,
      search_filters: searchFilters,
      country: req.headers.get('x-vercel-ip-country'),
      region: decode(req.headers.get('x-vercel-ip-country-region'))
    });
    if (error) console.error('Listing view not recorded', error.message);
  } catch (e) {
    console.error('Listing view route failed', e);
  }
  return done();
}
