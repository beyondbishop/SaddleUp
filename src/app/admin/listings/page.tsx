import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/roles';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import ModerationCard from '@/components/ModerationCard';
import { LISTING_STATUSES, STATUS_LABELS, STATUS_STYLES, saddleTitle, usd, type ListingStatus } from '@/lib/admin-listings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'All listings', robots: { index: false } };

const PAGE = 50;
const SORTS = {
  newest: { col: 'created_at', asc: false, label: 'Newest' },
  oldest: { col: 'created_at', asc: true, label: 'Oldest' },
  updated: { col: 'updated_at', asc: false, label: 'Recently updated' },
  price_high: { col: 'price_cents', asc: false, label: 'Price: high to low' },
  price_low: { col: 'price_cents', asc: true, label: 'Price: low to high' }
} as const;
type SortKey = keyof typeof SORTS;

type Params = { status?: string; q?: string; seller?: string; sort?: string; page?: string };

// Admin-only (checked here, not just in the layout). Listings that aren't live are
// hidden from everyone but their seller, so read with the service key.
export default async function AdminListingsPage({ searchParams }: { searchParams: Params }) {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/admin/listings');
  if (!isAdmin) redirect('/');
  const admin = createAdminClient();
  const status = (LISTING_STATUSES as readonly string[]).includes(searchParams.status ?? '') ? (searchParams.status as ListingStatus) : null;
  const q = (searchParams.q ?? '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 80);
  const seller = /^[0-9a-f-]{36}$/i.test(searchParams.seller ?? '') ? searchParams.seller! : null;
  const sortKey: SortKey = (searchParams.sort ?? '') in SORTS ? (searchParams.sort as SortKey) : status === 'draft' ? 'oldest' : 'newest';
  const sort = SORTS[sortKey];
  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);

  // Counts per status for the tabs, respecting the search and seller filters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (query: any) => {
    let out = query;
    if (q) out = out.or(`model.ilike.%${q}%,slug.ilike.%${q}%,location_city.ilike.%${q}%`);
    if (seller) out = out.eq('seller_id', seller);
    return out;
  };
  const countFor = (s: ListingStatus | null) => {
    let c = admin.from('listings').select('id', { count: 'exact', head: true });
    if (s) c = c.eq('status', s);
    return scoped(c);
  };

  let listQuery = admin
    .from('listings')
    .select('*, brands(name)', { count: 'exact' })
    .order(sort.col, { ascending: sort.asc })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (status) listQuery = listQuery.eq('status', status);
  listQuery = scoped(listQuery);

  const [all, perStatus, { data: listings, count }, sellerProfile] = await Promise.all([
    countFor(null),
    Promise.all(LISTING_STATUSES.map((s) => countFor(s))),
    listQuery,
    seller ? admin.from('profiles').select('full_name, email').eq('id', seller).single() : Promise.resolve({ data: null })
  ]);
  const tabCount = Object.fromEntries(LISTING_STATUSES.map((s, i) => [s, perStatus[i].count ?? 0])) as Record<ListingStatus, number>;

  const sellerIds = [...new Set((listings ?? []).map((l: any) => l.seller_id).filter(Boolean))];
  const { data: sellers } = sellerIds.length
    ? await admin.from('profiles').select('id, full_name, email').in('id', sellerIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const sellerOf = new Map((sellers ?? []).map((p) => [p.id, p]));

  const total = count ?? 0;
  const link = (p: Partial<Record<keyof Params, string | number | null>>) => {
    const merged: Record<string, string | number | null | undefined> = { status, q, seller, sort: searchParams.sort, page: 0, ...p };
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && v !== 0 && params.set(k, String(v)));
    return `/admin/listings${params.toString() ? `?${params}` : ''}`;
  };

  const tabs: { key: ListingStatus | null; label: string; n: number }[] = [
    { key: null, label: 'All', n: all.count ?? 0 },
    ...LISTING_STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s], n: tabCount[s] }))
  ];
  const sp = sellerProfile.data as { full_name: string | null; email: string } | null;

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <div>
          <h1 className="font-serif text-3xl text-saddle-ink">{status ? STATUS_LABELS[status] : 'All listings'}</h1>
          <p className="text-saddle-muted text-sm">
            {total.toLocaleString('en-US')} {total === 1 ? 'listing' : 'listings'}
            {q && <> matching “{q}”</>}
            {seller && <> from {sp?.full_name || sp?.email || 'this seller'} · <Link href={link({ seller: null })} className="underline">show everyone’s</Link></>}
          </p>
        </div>
        <Link href="/admin/quick-add" className="bg-saddle-green text-saddle-cream px-4 py-2 rounded-sm text-sm font-semibold">
          + Quick add a saddle
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {tabs.map((t) => {
          const active = t.key === status;
          return (
            <Link
              key={t.label}
              href={link({ status: t.key, sort: null })}
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap text-sm px-3 py-1.5 rounded-full border ${
                active ? 'bg-saddle-brown text-saddle-cream border-saddle-brown' : 'border-saddle-line bg-saddle-paper hover:border-saddle-brown'
              }`}
            >
              {t.label} <span className="tabular-nums opacity-75">{t.n}</span>
            </Link>
          );
        })}
      </div>

      <form method="get" className="flex flex-wrap gap-2 mb-4">
        {status && <input type="hidden" name="status" value={status} />}
        {seller && <input type="hidden" name="seller" value={seller} />}
        <label htmlFor="listing-q" className="sr-only">Search listings</label>
        <input id="listing-q" name="q" defaultValue={q} placeholder="Search model, brand or town" className="border rounded p-2 text-sm flex-1 min-w-[12rem]" />
        <label htmlFor="listing-sort" className="sr-only">Sort</label>
        <select id="listing-sort" name="sort" defaultValue={sortKey} className="border rounded p-2 text-sm">
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <button type="submit" className="bg-saddle-green text-white rounded px-4 text-sm font-semibold">Search</button>
      </form>

      {status === 'draft' ? (
        // Awaiting review keeps the approve/reject cards.
        <div className="space-y-3">
          {(listings ?? []).map((l: any) => (
            <ModerationCard key={l.id} listing={l} sellerEmail={l.seller_id ? sellerOf.get(l.seller_id)?.email : null} />
          ))}
          {!listings?.length && <p className="text-gray-500">Nothing waiting on review right now.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto border border-saddle-line rounded bg-white">
          <table className="w-full text-sm">
            <thead className="bg-saddle-sand text-left">
              <tr>
                <th className="p-2">Saddle</th>
                <th className="p-2">Seller</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Price</th>
                <th className="p-2">Listed</th>
                <th className="p-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {(listings ?? []).map((l: any) => {
                const s = l.seller_id ? sellerOf.get(l.seller_id) : null;
                return (
                  <tr key={l.id} className="border-t border-saddle-line align-middle">
                    <td className="p-2">
                      <div className="flex items-center gap-3 min-w-[16rem]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {l.images?.[0] ? <img src={l.images[0]} alt="" className="w-12 h-12 object-cover rounded shrink-0" /> : <div className="w-12 h-12 rounded bg-saddle-sand shrink-0" />}
                        <div className="min-w-0">
                          <Link href={`/saddles/${l.slug}`} className="font-semibold hover:underline">{saddleTitle(l)}</Link>
                          <p className="text-xs text-saddle-muted">
                            {[l.condition, l.location_city && `${l.location_city}${l.location_state ? `, ${l.location_state}` : ''}`, l.source === 'seeded' || l.ebay_item_id ? 'Imported' : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      {s ? (
                        <Link href={link({ seller: s.id })} className="hover:underline">
                          <span className="block">{s.full_name || s.email}</span>
                          {s.full_name && <span className="block text-xs text-saddle-muted break-all">{s.email}</span>}
                        </Link>
                      ) : (
                        <span className="text-saddle-faint">Not claimed</span>
                      )}
                    </td>
                    <td className="p-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[l.status as ListingStatus]}`}>
                        {STATUS_LABELS[l.status as ListingStatus]}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums whitespace-nowrap">{usd(l.price_cents)}</td>
                    <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('en-US')}</td>
                    <td className="p-2 whitespace-nowrap text-right">
                      <Link href={`/dashboard/listings/${l.id}/edit`} className="underline mr-3">Edit</Link>
                      <Link href={`/dashboard/listings/${l.id}/stats`} className="underline">Stats</Link>
                    </td>
                  </tr>
                );
              })}
              {!listings?.length && (
                <tr><td colSpan={6} className="p-4 text-saddle-muted">No listings match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between mt-4 text-sm">
        {page > 0 ? <Link href={link({ page: page - 1, sort: searchParams.sort })} className="underline">← Previous</Link> : <span />}
        {(page + 1) * PAGE < total && <Link href={link({ page: page + 1, sort: searchParams.sort })} className="underline">Next →</Link>}
      </div>
    </div>
  );
}
