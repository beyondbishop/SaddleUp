import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ConnectPayoutsButton from '@/components/ConnectPayoutsButton';
import DeleteListingButton from '@/components/DeleteListingButton';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/dashboard');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const { data: listings } = await supabase
    .from('listings')
    .select('*, brands(name)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-saddle-brown">Your Listings</h1>
        <Link href="/dashboard/listings/new" className="bg-saddle-green text-white px-4 py-2 rounded-md font-semibold">
          + New Listing
        </Link>
      </div>

      {!profile?.stripe_connect_onboarded && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm">
            Set up payouts to start receiving money from sales (SaddleUp uses Stripe Connect —
            you keep 80% of every sale, or the sale price minus $500, whichever is less).
          </p>
          <ConnectPayoutsButton />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {listings?.map((l) => (
          <div key={l.id} className="bg-white border border-saddle-tan rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {l.seat_size}&quot; {l.brands?.name} {l.model}
              </p>
              <p className="text-sm text-gray-500">
                {l.status} · ${(l.price_cents / 100).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/saddles/${l.slug}`} className="underline">View</Link>
              <Link href={`/dashboard/listings/${l.id}/edit`} className="underline">Edit</Link>
              <DeleteListingButton listingId={l.id} />
            </div>
          </div>
        ))}
        {listings?.length === 0 && <p className="text-gray-500">You haven&apos;t listed a saddle yet.</p>}
      </div>
    </div>
  );
}
