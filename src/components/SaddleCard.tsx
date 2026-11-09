import Link from 'next/link';
import Image from 'next/image';
import { Listing, treeWidthText } from '@/lib/types';
import FavoriteButton from './FavoriteButton';
import Avatar from './Avatar';
import { CONDITION_LABELS, type Condition } from '@/lib/search';

export default function SaddleCard({ listing, seller, distance }: {
  listing: Listing;
  /** The seller's first name and headshot, shown on the photo. */
  seller?: { firstName: string; initials: string; avatarUrl: string | null } | null;
  /** e.g. "120 mi away", when we know roughly where the shopper is. */
  distance?: string | null;
}) {
  const price = (listing.price_cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
  // Priced under the low end of its fair-price range: same rule the saddle's page calls "a good deal".
  const place = [listing.location_city, listing.location_state].filter(Boolean).join(', ');
  const goodValue = !!listing.price_range_low && listing.price_cents / 100 < listing.price_range_low;

  return (
    <div className="bg-white border border-saddle-tan rounded-lg overflow-hidden relative group">
      <FavoriteButton listingId={listing.id} className="absolute top-2 right-2 z-10" />
      <Link href={`/saddles/${listing.slug}`}>
        <div className="aspect-[4/3] bg-saddle-cream relative">
          {listing.images?.[0] ? (
            <Image
              src={listing.images[0]}
              alt={`${listing.seat_size}" ${listing.brands?.name ?? ''} ${listing.model}`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-saddle-brown/40">
              No photo yet
            </div>
          )}
          {goodValue && (
            <span
              title="Priced below what similar used saddles usually sell for"
              className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-saddle-green px-2.5 py-1 text-xs font-semibold text-white shadow-md ring-2 ring-white/70"
            >
              <span aria-hidden="true">✨</span> Sweet deal
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="font-semibold text-saddle-brown">
            {listing.seat_size}&quot; {listing.brands?.name} {listing.model}
            {listing.year_manufactured ? (
              <span className="ml-1.5 align-middle rounded bg-saddle-cream px-1.5 py-0.5 text-xs font-semibold text-saddle-brown/80">
                {listing.year_manufactured}
              </span>
            ) : null}
          </p>
          <p className="text-sm text-gray-600">
            {listing.condition
              ? CONDITION_LABELS[listing.condition as Condition] ?? listing.condition
              : 'Condition not stated'}
            {' · '}
            {treeWidthText(listing.tree_width)}
          </p>
          {(place || distance) && (
            <p className="text-xs text-gray-500">
              {place}
              {place && distance ? ' · ' : ''}
              {distance && <span className="text-saddle-green font-semibold">{distance}</span>}
            </p>
          )}
          <div className="flex items-end justify-between gap-2 mt-1">
            <p className="font-bold">{price}</p>
            {seller && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-saddle-ink min-w-0">
                <span className="truncate">{seller.firstName}</span>
                <Avatar url={seller.avatarUrl} initials={seller.initials} size={32} />
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
