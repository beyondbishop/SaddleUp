import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { matchListing, type SearchCriteria, FOR_SALE } from '@/lib/search';
import { readPrefs } from '@/lib/notification-prefs';
import { SITE_URL } from '@/lib/site';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Call this on a schedule (Vercel Cron — see vercel.json) once daily.
// Protects itself with CRON_SECRET so randoms on the internet can't trigger it.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Look at listings created in roughly the last 25 hours — a bit more than
  // a full day so a slightly-late run never skips a listing at the boundary.
  const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const { data: newListings } = await admin
    .from('listings')
    .select('*, brands(name, slug)')
    .or(FOR_SALE)
    .gte('created_at', since);

  if (!newListings?.length) return NextResponse.json({ checked: 0, notified: 0 });

  const { data: savedSearches } = await admin
    .from('saved_searches')
    .select('*, profiles(email), brands(slug)');

  let notified = 0;
  // Members who turned saved search alerts off still get matches recorded, so turning it back on doesn't send a backlog.
  const prefsById = await readPrefs(admin, [...new Set((savedSearches ?? []).map((s: any) => s.user_id).filter(Boolean))] as string[]);

  for (const search of savedSearches ?? []) {
    // Same matching rules as the browse page (src/lib/search.ts).
    const criteria: SearchCriteria = {
      discipline: search.discipline ?? undefined,
      brand: (search as any).brands?.slug ?? undefined,
      seat_min: search.seat_size_min ?? undefined,
      seat_max: search.seat_size_max ?? undefined,
      tree: search.tree_widths?.length ? search.tree_widths : undefined,
      price_max: search.price_max_cents != null ? search.price_max_cents / 100 : undefined
    };
    const matches = newListings.filter((l) => matchListing(l, criteria).matches);

    if (!matches.length) continue;

    // De-dupe: don't email about a listing we've already alerted this search about.
    const { data: alreadySent } = await admin
      .from('saved_search_matches_sent')
      .select('listing_id')
      .eq('saved_search_id', search.id);
    const sentIds = new Set(alreadySent?.map((r) => r.listing_id));
    const unseenMatches = matches.filter((m) => !sentIds.has(m.id));
    if (!unseenMatches.length) continue;

    const email = (search as any).profiles?.email;
    const wantsEmail = prefsById.get((search as any).user_id)?.matches_email !== false;
    if (email && resend && wantsEmail) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: email,
        subject: `New match for "${search.label}"`,
        html: `
          <p>A new saddle matching your watchlist alert just went live:</p>
          <ul>
            ${unseenMatches
              .map(
                (m) =>
                  `<li><a href="${SITE_URL}/saddles/${m.slug}">${m.seat_size}" ${m.brands?.name} ${m.model} — $${(m.price_cents / 100).toLocaleString()}</a></li>`
              )
              .join('')}
          </ul>
        `
      });
      notified++;
    }

    await admin.from('saved_search_matches_sent').insert(
      unseenMatches.map((m) => ({ saved_search_id: search.id, listing_id: m.id }))
    );
  }

  return NextResponse.json({ checked: newListings.length, notified });
}
