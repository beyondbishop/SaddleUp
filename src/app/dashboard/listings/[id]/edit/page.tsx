import { createAdminClient, createClient } from '@/lib/supabase/server';
import { listingAccess } from '@/lib/listing-access';
import { brandsForPicker } from '@/lib/brands-server';
import { isUuid } from '@/lib/lists-server';
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

  if (!isUuid(params.id)) return notFound();

  // Sellers edit their own listings, admins any, importers the unclaimed ones they added.
  const { access, isAdmin } = await listingAccess(params.id);
  if (!access) return notFound();
  const { data: listing } = await createAdminClient().from('listings').select('*').eq('id', params.id).single();
  if (!listing) return notFound();
  const brands = await brandsForPicker(supabase, { userId: user.id, isAdmin, includeId: listing.brand_id });
  const editingForSeller = access === 'admin';

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
      {access === 'importer' && (
        <div className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-3 mb-4 text-sm text-saddle-brown">
          You added this saddle and the seller hasn&apos;t claimed it yet, so you can still fix its details and photos.
        </div>
      )}
      <ListingForm brands={brands} existing={listing as any} afterSave={access === 'importer' ? `/imports?open=${listing.id}#import-${listing.id}` : editingForSeller ? '/admin/listings' : '/dashboard'} />
    </div>
  );
}
