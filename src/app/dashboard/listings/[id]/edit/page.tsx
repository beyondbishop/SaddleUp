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
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  const isAdmin = !!profile?.is_admin;

  // Sellers edit their own listings; admins can edit any (row-level security enforces the same).
  let query = supabase.from('listings').select('*').eq('id', params.id);
  if (!isAdmin) query = query.eq('seller_id', user.id);
  const { data: listing } = await query.single();

  if (!listing) return notFound();
  const editingForSeller = isAdmin && listing.seller_id !== user.id;

  return (
    <div className="py-8">
      {searchParams.claimed && (
        <div className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-4 mb-6">
          <p className="font-serif text-xl text-saddle-ink mb-1">It&apos;s yours — one last step</p>
          <p className="text-sm text-saddle-muted">
            {listing.images?.length
              ? 'Your photos are already on it. Check the details and photos below, add more if you like, then save.'
              : 'Add a few photos and check the details below, then save.'}{' '}
            Your listing goes live after a quick review (usually same-day).
          </p>
        </div>
      )}
      {editingForSeller && (
        <div className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-3 mb-4 text-sm text-saddle-brown">
          You&apos;re editing someone else&apos;s listing as an admin. Your changes save to their listing.
        </div>
      )}
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Edit Listing</h1>
      <ListingForm brands={brands ?? []} existing={listing as any} afterSave={editingForSeller ? '/admin/listings' : '/dashboard'} />
    </div>
  );
}
