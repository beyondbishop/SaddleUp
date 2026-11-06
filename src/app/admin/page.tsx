import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/roles';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { LISTING_STATUSES, STATUS_LABELS, STATUS_STYLES, saddleTitle, usd, type ListingStatus } from '@/lib/admin-listings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false } };

// Admin-only (checked here, not just in the layout), so read with the service key.
export default async function AdminDashboardPage() {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/admin');
  if (!isAdmin) redirect('/');
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const head = { count: 'exact' as const, head: true };

  const [statusCounts, newListings, users, newUsers, openReviews, overdue, rewardsOwed, liveValue, recent, signups] = await Promise.all([
    Promise.all(LISTING_STATUSES.map((s) => admin.from('listings').select('id', head).eq('status', s))),
    admin.from('listings').select('id', head).gte('created_at', weekAgo),
    admin.from('profiles').select('id', head),
    admin.from('profiles').select('id', head).gte('created_at', weekAgo),
    admin.from('orders').select('id', head).eq('review_status', 'open'),
    admin.from('orders').select('id', head).eq('status', 'paid').is('shipped_at', null).is('delivered_at', null).lt('dispatch_due_at', nowIso),
    admin.from('importer_rewards').select('id', head).eq('status', 'earned'),
    admin.from('listings').select('price_cents').eq('status', 'active').limit(5000),
    admin.from('listings').select('id, slug, model, seat_size, price_cents, status, images, created_at, seller_id, brands(name)').order('created_at', { ascending: false }).limit(8),
    admin.from('profiles').select('id, full_name, email, created_at').order('created_at', { ascending: false }).limit(6)
  ]);

  const byStatus = Object.fromEntries(LISTING_STATUSES.map((s, i) => [s, statusCounts[i].count ?? 0])) as Record<ListingStatus, number>;
  const totalListings = LISTING_STATUSES.reduce((n, s) => n + byStatus[s], 0);
  const liveTotal = (liveValue.data ?? []).reduce((n, r) => n + (r.price_cents ?? 0), 0);
  const needsAttention = (openReviews.count ?? 0) + (overdue.count ?? 0);

  const sellerIds = [...new Set((recent.data ?? []).map((l: any) => l.seller_id).filter(Boolean))];
  const { data: sellers } = sellerIds.length ? await admin.from('profiles').select('id, email').in('id', sellerIds) : { data: [] as any[] };
  const emailOf = new Map((sellers ?? []).map((p: any) => [p.id, p.email]));

  const tiles = [
    { label: 'All listings', value: totalListings, sub: `${newListings.count ?? 0} new this week`, href: '/admin/listings' },
    { label: 'Live now', value: byStatus.active, sub: `${usd(liveTotal)} asking`, href: '/admin/listings?status=active' },
    { label: 'Awaiting review', value: byStatus.draft, sub: byStatus.draft ? 'Needs a decision' : 'All caught up', href: '/admin/listings?status=draft', alert: byStatus.draft > 0 },
    { label: 'Orders needing attention', value: needsAttention, sub: `${openReviews.count ?? 0} returns/problems · ${overdue.count ?? 0} overdue`, href: '/admin/orders', alert: needsAttention > 0 },
    { label: 'Users', value: users.count ?? 0, sub: `${newUsers.count ?? 0} joined this week`, href: '/admin/users' },
    { label: 'Rewards to pay', value: rewardsOwed.count ?? 0, sub: 'Importer rewards earned', href: '/admin/rewards', alert: (rewardsOwed.count ?? 0) > 0 }
  ];

  return (
    <div className="py-6 space-y-8">
      <section aria-label="At a glance" className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={`block bg-saddle-paper border rounded p-4 hover:border-saddle-brown transition-colors ${t.alert ? 'border-saddle-gold' : 'border-saddle-line'}`}
          >
            <p className="text-xs text-saddle-muted">{t.label}</p>
            <p className="font-serif text-3xl text-saddle-ink tabular-nums">{t.value.toLocaleString('en-US')}</p>
            <p className={`text-xs ${t.alert ? 'text-saddle-gold font-semibold' : 'text-saddle-faint'}`}>{t.sub}</p>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="font-semibold text-saddle-brown mb-2">Listings by status</h2>
        <div className="flex h-3 rounded overflow-hidden bg-saddle-sand" role="img" aria-label="Share of listings in each status">
          {LISTING_STATUSES.filter((s) => byStatus[s]).map((s) => (
            <div key={s} className={STATUS_STYLES[s]} style={{ width: `${(byStatus[s] / Math.max(totalListings, 1)) * 100}%` }} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
          {LISTING_STATUSES.map((s) => (
            <li key={s}>
              <Link href={`/admin/listings?status=${s}`} className="hover:underline">
                <span className={`inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle ${STATUS_STYLES[s]}`} />
                {STATUS_LABELS[s]} <span className="tabular-nums text-saddle-muted">{byStatus[s]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-semibold text-saddle-brown">Newest listings</h2>
            <Link href="/admin/listings" className="text-sm underline">See all</Link>
          </div>
          <ul className="bg-white border border-saddle-line rounded divide-y divide-saddle-line">
            {(recent.data ?? []).map((l: any) => (
              <li key={l.id} className="flex items-center gap-3 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.images?.[0] ? <img src={l.images[0]} alt="" className="w-12 h-12 object-cover rounded" /> : <div className="w-12 h-12 rounded bg-saddle-sand" />}
                <div className="min-w-0 flex-1">
                  <Link href={`/saddles/${l.slug}`} className="font-semibold text-sm hover:underline block truncate">{saddleTitle(l)}</Link>
                  <p className="text-xs text-saddle-muted truncate">
                    {usd(l.price_cents)} · {l.seller_id ? emailOf.get(l.seller_id) ?? 'Unknown seller' : 'No seller yet'} · {new Date(l.created_at).toLocaleDateString('en-US')}
                  </p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[l.status as ListingStatus]}`}>{STATUS_LABELS[l.status as ListingStatus]}</span>
              </li>
            ))}
            {!recent.data?.length && <li className="p-3 text-sm text-saddle-muted">No listings yet.</li>}
          </ul>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-semibold text-saddle-brown">New users</h2>
            <Link href="/admin/users" className="text-sm underline">See all</Link>
          </div>
          <ul className="bg-white border border-saddle-line rounded divide-y divide-saddle-line">
            {(signups.data ?? []).map((p) => (
              <li key={p.id} className="p-2 text-sm">
                <p className="font-semibold truncate">{p.full_name || p.email}</p>
                <p className="text-xs text-saddle-muted">{p.full_name ? `${p.email} · ` : ''}{new Date(p.created_at).toLocaleDateString('en-US')}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
