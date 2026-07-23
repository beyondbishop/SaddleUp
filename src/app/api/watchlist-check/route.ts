import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    .select('*, brands(name)')
    .eq('status', 'active')
    .gte('created_at', since);

  if (!newListings?.length) return NextResponse.json({ checked: 0, notified: 0 });

  const { data: savedSearches } = await admin
    .from('saved_searches')
    .select('*, profiles(email)');

  let notified = 0;

  for (const search of savedSearches ?? []) {
    const matches = newListings.filter((l) => {
      if (search.discipline && l.discipline !== search.discipline) return false;
      if (search.brand_id && l.brand_id !== search.brand_id) return false;
      if (search.seat_size_min && l.seat_size < search.seat_size_min) return false;
      if (search.seat_size_max && l.seat_size > search.seat_size_max) return false;
      if (search.tree_widths?.length && !search.tree_widths.includes(l.tree_width)) return false;
      if (search.price_max_cents && l.price_cents > search.price_max_cents) return false;
      return true;
    });

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
    if (email && process.env.RESEND_API_KEY) {
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
                  `<li><a href="${process.env.NEXT_PUBLIC_SITE_URL}/saddles/${m.slug}">${m.seat_size}" ${m.brands?.name} ${m.model} — $${(m.price_cents / 100).toLocaleString()}</a></li>`
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
