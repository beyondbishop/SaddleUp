import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import UserRoleControls from '@/components/admin/UserRoleControls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users', robots: { index: false } };

const PAGE = 50;

type Counts = Record<string, number>;
const tally = (rows: { k: string | null }[] | null) =>
  (rows ?? []).reduce<Counts>((acc, r) => (r.k ? ((acc[r.k] = (acc[r.k] ?? 0) + 1), acc) : acc), {});

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string; role?: string; page?: string } }) {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/admin/users');
  if (!isAdmin) redirect('/');

  // Profiles are private to their owner; this page is admin-only, so read with the service key.
  const admin = createAdminClient();
  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);
  const q = (searchParams.q ?? '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 80);

  let query = admin
    .from('profiles')
    .select('id, full_name, email, phone, is_admin, is_importer, stripe_connect_onboarded, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (searchParams.role === 'admin') query = query.eq('is_admin', true);
  if (searchParams.role === 'importer') query = query.eq('is_importer', true);
  const { data: profiles, count } = await query;

  const ids = (profiles ?? []).map((p) => p.id);
  const [listings, live, bought, imports, importStatus] = ids.length
    ? await Promise.all([
        admin.from('listings').select('k:seller_id').in('seller_id', ids),
        admin.from('listings').select('k:seller_id').in('seller_id', ids).in('status', ['active', 'pending_sale']),
        admin.from('orders').select('k:buyer_id').in('buyer_id', ids).eq('status', 'paid'),
        admin.from('listing_imports').select('k:importer_id').in('importer_id', ids),
        admin.from('listing_imports').select('importer_id, listings(status, claimed_at)').in('importer_id', ids)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const listingCount = tally(listings.data as any);
  const liveCount = tally(live.data as any);
  const boughtCount = tally(bought.data as any);
  const importCount = tally(imports.data as any);
  const claimedCount: Counts = {};
  const soldCount: Counts = {};
  for (const r of (importStatus.data ?? []) as any[]) {
    if (r.listings?.claimed_at) claimedCount[r.importer_id] = (claimedCount[r.importer_id] ?? 0) + 1;
    if (r.listings?.status === 'sold') soldCount[r.importer_id] = (soldCount[r.importer_id] ?? 0) + 1;
  }

  const total = count ?? 0;
  const link = (p: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, role: searchParams.role, page: 0, ...p };
    Object.entries(merged).forEach(([k, v]) => v !== undefined && v !== '' && v !== 0 && params.set(k, String(v)));
    return `/admin/users${params.toString() ? `?${params}` : ''}`;
  };

  return (
    <div className="py-8">
      <h1 className="font-serif text-3xl text-saddle-ink mb-1">Users</h1>
      <p className="text-saddle-muted mb-4">{total} {total === 1 ? 'person' : 'people'}{q ? ` matching “${q}”` : ''}</p>

      <form method="get" className="flex flex-wrap gap-2 mb-4">
        <label htmlFor="user-q" className="sr-only">Search by name or email</label>
        <input id="user-q" name="q" defaultValue={q} placeholder="Search name or email" className="border rounded p-2 text-sm flex-1 min-w-[12rem]" />
        <label htmlFor="user-role" className="sr-only">Role</label>
        <select id="user-role" name="role" defaultValue={searchParams.role ?? ''} className="border rounded p-2 text-sm">
          <option value="">Everyone</option>
          <option value="importer">Importers</option>
          <option value="admin">Admins</option>
        </select>
        <button type="submit" className="bg-saddle-green text-white rounded px-4 text-sm font-semibold">Search</button>
      </form>

      <div className="overflow-x-auto border border-saddle-line rounded bg-white">
        <table className="w-full text-sm">
          <thead className="bg-saddle-sand text-left">
            <tr>
              <th className="p-2">Person</th>
              <th className="p-2">Joined</th>
              <th className="p-2">Selling</th>
              <th className="p-2">Bought</th>
              <th className="p-2">Imports</th>
              <th className="p-2">Access</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <tr key={p.id} className="border-t border-saddle-line align-top">
                <td className="p-2">
                  <p className="font-semibold">{p.full_name || '—'}</p>
                  <p className="text-gray-600 break-all">{p.email}</p>
                  {p.phone && <p className="text-gray-500">{p.phone}</p>}
                </td>
                <td className="p-2 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString('en-US')}</td>
                <td className="p-2 whitespace-nowrap">
                  {listingCount[p.id]
                    ? <Link href={`/admin/listings?seller=${p.id}`} className="underline">{listingCount[p.id]} listed · {liveCount[p.id] ?? 0} live</Link>
                    : '0 listed'}
                  <p className="text-xs text-gray-500">{p.stripe_connect_onboarded ? 'Payouts set up' : 'No payouts yet'}</p>
                </td>
                <td className="p-2">{boughtCount[p.id] ?? 0}</td>
                <td className="p-2 whitespace-nowrap">
                  {importCount[p.id]
                    ? <Link href={`/imports?importer=${p.id}`} className="underline">{importCount[p.id]} added · {claimedCount[p.id] ?? 0} claimed · {soldCount[p.id] ?? 0} sold</Link>
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="p-2">
                  <UserRoleControls userId={p.id} isAdmin={p.is_admin} isImporter={p.is_importer} isSelf={p.id === user.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between mt-4 text-sm">
        {page > 0 ? <Link href={link({ page: page - 1 })} className="underline">← Newer</Link> : <span />}
        {(page + 1) * PAGE < total && <Link href={link({ page: page + 1 })} className="underline">Older →</Link>}
      </div>
    </div>
  );
}
