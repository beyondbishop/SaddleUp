import { createAdminClient, createClient } from '@/lib/supabase/server';
import { listingAccess } from '@/lib/listing-access';
import { brandsForPicker } from '@/lib/brands-server';
import { isUuid } from '@/lib/lists-server';
import { redirect, notFound } from 'next/navigation';
import ListingForm from '@/components/ListingForm';
import ListingStatusPicker from '@/components/admin/ListingStatusPicker';
import { STATUS_LABELS, type ListingStatus } from '@/lib/admin-listings';
import { claimNotes } from '@/lib/claim-message';

/** One note, with its "Label:" in bold and any web address as a link. */
function Note({ text }: { text: string }) {
  const m = text.match(/^([A-Z][\w ]{1,20}):\s*([\s\S]*)$/);
  const [label, rest] = m ? [m[1], m[2]] : [null, text];
  return (
    <li>
      {label && <strong className="text-saddle-ink">{label}: </strong>}
      {rest.split(/(https?:\/\/\S+)/).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part.replace(/^https?:\/\/[^/]+/, '')} className="underline text-saddle-brown">
            our measuring guide
          </a>
        ) : (
          part
        )
      )}
    </li>
  );
}

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

  // What we noticed while importing it, shown to the seller for their first two weeks after claiming
  // (the Facebook message is kept short, so this is where they see it).
  const recentlyClaimed =
    !!searchParams.claimed || (!!listing.claimed_at && Date.now() - new Date(listing.claimed_at).getTime() < 14 * 24 * 3600 * 1000);
  let importNotes: string[] = [];
  if (access === 'seller' && recentlyClaimed) {
    const { data: imp } = await createAdminClient().from('listing_imports').select('seller_notes').eq('listing_id', listing.id).maybeSingle();
    if (imp) {
      const saved = (imp.seller_notes ?? {}) as { spellingFixes?: string[]; listingNotes?: string[]; measureGuide?: boolean };
      importNotes = claimNotes({
        ...saved,
        treeMissing: !listing.tree_width,
        askingPrice: listing.price_cents ? listing.price_cents / 100 : null,
        priceRange: listing.price_range_typical
          ? { low: listing.price_range_low, typical: listing.price_range_typical, high: listing.price_range_high }
          : null
      });
    }
  }

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
      {importNotes.length > 0 && (
        <div className="max-w-2xl bg-white border border-saddle-line rounded p-4 mb-6">
          <p className="font-serif text-lg text-saddle-ink mb-1">Here&apos;s what we found about your saddle</p>
          <p className="text-sm text-saddle-muted mb-3">
            We filled in your listing from your post. Please make sure this is correct, and change anything below that isn&apos;t.
          </p>
          <ul className="text-sm text-saddle-muted space-y-2 list-disc pl-5">
            {importNotes.map((n) => (
              <Note key={n} text={n} />
            ))}
          </ul>
        </div>
      )}
      {editingForSeller && (
        <div className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-3 mb-4 text-sm text-saddle-brown">
          You&apos;re editing someone else&apos;s listing as an admin. Your changes save to their listing.
        </div>
      )}
      <h1 className="text-2xl font-bold text-saddle-brown mb-6">Edit Listing</h1>
      {isAdmin && (
        <div className="max-w-2xl bg-white border border-saddle-line rounded p-4 mb-6 space-y-2">
          <p className="text-sm text-saddle-muted">
            Now: <strong className="text-saddle-ink">{STATUS_LABELS[listing.status as ListingStatus] ?? listing.status}</strong>
            {listing.status === 'unclaimed' && (listing.show_before_claim ? ', showing on the site' : ', hidden from the site')}
            {listing.slug && (listing.status === 'active' || (listing.status === 'unclaimed' && listing.show_before_claim)) && (
              <> · <a href={`/saddles/${listing.slug}`} className="underline text-saddle-brown">View on site</a></>
            )}
          </p>
          <ListingStatusPicker listing={listing} />
          <p className="text-xs text-saddle-muted">Changes save straight away. Removed and draft saddles are hidden, never deleted, so you can always put them back.</p>
        </div>
      )}
      {access === 'importer' && (
        <div className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-3 mb-4 text-sm text-saddle-brown">
          You added this saddle and the seller hasn&apos;t claimed it yet, so you can still fix its details and photos.
        </div>
      )}
      <ListingForm brands={brands} existing={listing as any} afterSave={access === 'importer' ? `/imports?open=${listing.id}#import-${listing.id}` : editingForSeller ? '/admin/listings' : '/dashboard'} />
    </div>
  );
}
