import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NewListingWithEbayImport from '@/components/EbayImport';
import { ebayConfigured } from '@/lib/ebay/client';
import { brandsForPicker } from '@/lib/brands-server';

export default async function NewListingPage({ searchParams }: { searchParams: { from?: string } }) {
  // ?from=home: a "What's your saddle worth?" check from the home page is waiting in this browser.
  const fromHome = searchParams.from === 'home';
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/signup?next=${encodeURIComponent(`/dashboard/listings/new${fromHome ? '?from=home' : ''}`)}`);

  const brands = await brandsForPicker(supabase, { userId: user.id });

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">List Your Saddle</h1>
      <p className="text-sm text-gray-600 mb-6">
        New listings go through a quick review (usually same-day) before they appear publicly.
      </p>
      <NewListingWithEbayImport brands={brands} ebayEnabled={ebayConfigured()} fromHome={fromHome} />
    </div>
  );
}
