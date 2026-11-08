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
        </div>
        <div className="p-3">
          <p className="font-semibold text-saddle-brown">
            {listing.seat_size}&quot; {listing.brands?.name} {listing.model}
          </p>
          <p className="text-sm text-gray-600">
            {treeWidthText(listing.tree_width)}
            {listing.location_state ? ` · ${listing.location_state}` : ''}
          </p>
          {distance && <p className="text-xs text-saddle-green font-semibold">{distance}</p>}
          <p className="text-xs text-gray-500">
            {listing.condition
              ? `${CONDITION_LABELS[listing.condition as Condition] ?? listing.condition} condition`
              : 'Condition not stated'}
          </p>
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
