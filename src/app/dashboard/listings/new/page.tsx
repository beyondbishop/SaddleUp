import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ListingForm from '@/components/ListingForm';

export default async function NewListingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/dashboard/listings/new');

  const { data: brands } = await supabase.from('brands').select('id, name').order('name');

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">List Your Saddle</h1>
      <p className="text-sm text-gray-600 mb-6">
        New listings go through a quick review (usually same-day) before they appear publicly.
      </p>
      <ListingForm brands={brands ?? []} />
    </div>
  );
}
