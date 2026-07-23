import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import WatchlistForm from '@/components/WatchlistForm';
import DeleteSavedSearchButton from '@/components/DeleteSavedSearchButton';
import { TREE_WIDTH_LABELS, DISCIPLINE_LABELS } from '@/lib/types';

export default async function WatchlistPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/watchlist');

  const { data: brands } = await supabase.from('brands').select('id, name');
  const { data: savedSearches } = await supabase
    .from('saved_searches')
    .select('*, brands(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="py-8 grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
      <div>
        <h1 className="text-2xl font-bold text-saddle-brown mb-6">Your Watchlist</h1>
        <p className="text-sm text-gray-600 mb-4">
          We&apos;ll email you as soon as a new saddle matches any of these — no need to keep checking back.
        </p>
        <div className="space-y-3">
          {savedSearches?.map((s: any) => (
            <div key={s.id} className="bg-white border border-saddle-tan rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-sm text-gray-500">
                    {[
                      s.discipline && DISCIPLINE_LABELS[s.discipline as keyof typeof DISCIPLINE_LABELS],
                      s.brands?.name,
                      s.seat_size_min && `${s.seat_size_min}"–${s.seat_size_max ?? '∞'}"`,
                      s.tree_widths?.length && s.tree_widths.map((t: string) => TREE_WIDTH_LABELS[t as keyof typeof TREE_WIDTH_LABELS]).join('/'),
                      s.price_max_cents && `under $${(s.price_max_cents / 100).toLocaleString()}`
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <DeleteSavedSearchButton id={s.id} />
              </div>
            </div>
          ))}
          {savedSearches?.length === 0 && <p className="text-gray-500">No saved searches yet.</p>}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Create a new alert</h2>
        <WatchlistForm brands={brands ?? []} />
      </div>
    </div>
  );
}
