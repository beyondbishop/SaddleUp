import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/roles';
import { REWARD_PERCENT } from '@/lib/rewards';
import PayRewardsButton from '@/components/admin/PayRewardsButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Importer rewards', robots: { index: false } };

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function AdminRewardsPage() {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/admin/rewards');
  if (!isAdmin) redirect('/');

  const admin = createAdminClient();
  const { data: rewards } = await admin
    .from('importer_rewards')
    .select('*, listings(model, seat_size, brands(name))')
    .order('created_at', { ascending: false })
    .limit(1000);
  const importerIds = [...new Set((rewards ?? []).map((r) => r.importer_id))];
  const { data: people } = importerIds.length
    ? await admin.from('profiles').select('id, full_name, email').in('id', importerIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email || 'Unknown']));

  const owed = (rewards ?? []).filter((r) => r.status === 'earned');
  const byImporter = new Map<string, typeof owed>();
  for (const r of owed) byImporter.set(r.importer_id, [...(byImporter.get(r.importer_id) ?? []), r]);
  const review = (rewards ?? []).filter((r) => r.needs_review);
  const history = (rewards ?? []).filter((r) => r.status !== 'earned');
  const saddle = (r: any) => `${r.listings?.seat_size}" ${r.listings?.brands?.name ?? ''} ${r.listings?.model ?? ''}`.replace(/\s+/g, ' ').trim();

  return (
    <div className="py-8 max-w-4xl">
      <h1 className="font-serif text-3xl text-saddle-ink mb-1">Importer rewards</h1>
      <p className="text-saddle-muted mb-6">
        Importers earn {REWARD_PERCENT}% of what SaddleUp keeps on a sale (our fee minus Stripe&apos;s processing fee), once the
        sale is final. No reward when the importer is the buyer or seller. Paying happens outside SaddleUp for now; record it here.
      </p>

      {review.length > 0 && (
        <section className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <h2 className="font-semibold text-red-800">Needs your attention</h2>
          <ul className="text-sm mt-2 space-y-1">
            {review.map((r) => (
              <li key={r.order_id}>
                {name.get(r.importer_id)}: {saddle(r)}, {usd(r.amount_cents)}. {r.void_reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="font-semibold text-saddle-brown mb-2">Owed</h2>
      {byImporter.size === 0 && <p className="text-gray-600 mb-6">Nothing owed right now.</p>}
      <div className="space-y-4 mb-8">
        {[...byImporter.entries()].map(([importerId, list]) => {
          const total = list.reduce((s, r) => s + r.amount_cents, 0);
          return (
            <section key={importerId} className="bg-white border border-saddle-line rounded p-4">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                  <p className="font-semibold">{name.get(importerId)}</p>
                  <p className="text-sm text-gray-600">{list.length} {list.length === 1 ? 'sale' : 'sales'} · owed {usd(total)}</p>
                  <Link href={`/imports?importer=${importerId}`} className="text-xs underline">Their imports</Link>
                </div>
                <PayRewardsButton rewardIds={list.map((r) => r.order_id)} totalLabel={usd(total)} person={String(name.get(importerId))} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm mt-3">
                  <thead className="text-left text-gray-500">
                    <tr><th className="py-1 pr-2">Saddle</th><th className="pr-2">Sale</th><th className="pr-2">Our fee</th><th className="pr-2">Stripe fee</th><th className="pr-2">Net</th><th>Reward</th></tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.order_id} className="border-t border-saddle-line">
                        <td className="py-1 pr-2">{saddle(r)}</td>
                        <td className="pr-2">{usd(r.sale_price_cents)}</td>
                        <td className="pr-2">{usd(r.platform_fee_cents)}</td>
                        <td className="pr-2">{usd(r.processing_fee_cents)}</td>
                        <td className="pr-2">{usd(r.net_cents)}</td>
                        <td className="font-semibold">{usd(r.amount_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      <h2 className="font-semibold text-saddle-brown mb-2">History</h2>
      {history.length === 0 ? (
        <p className="text-gray-600">No paid or cancelled rewards yet.</p>
      ) : (
        <ul className="bg-white border border-saddle-line rounded divide-y divide-saddle-line text-sm">
          {history.map((r) => (
            <li key={r.order_id} className="p-3 flex flex-wrap justify-between gap-2">
              <span>{name.get(r.importer_id)}: {saddle(r)}</span>
              <span>
                {r.status === 'paid'
                  ? `Paid ${usd(r.amount_cents)} on ${new Date(r.paid_at).toLocaleDateString('en-US')}${r.paid_note ? ` (${r.paid_note})` : ''}`
                  : `No reward: ${r.void_reason ?? 'cancelled'}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
