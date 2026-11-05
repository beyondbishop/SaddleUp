import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import ListingForm from '@/components/ListingForm';

export default async function EditListingPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { claimed?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: brands } = await supabase.from('brands').select('id, name').order('name');
  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', params.id)
    .eq('seller_id', user.id)
    .single();

  if (!listing) return notFound();

  return (
    <div className="py-8">
      {searchParams.claimed && (
        <div className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-4 mb-6">
          <p className="font-serif text-xl text-saddle-ink mb-1">It&apos;s yours — one last step</p>
          <p className="text-sm text-saddle-muted">
            Add a few photos and check the details below, then save. Your listing goes live after a quick review
            (usually same-day).
          </p>
        </div>
      )}
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Edit Listing</h1>
      <ListingForm brands={brands ?? []} existing={listing as any} />
    </div>
  );
}
