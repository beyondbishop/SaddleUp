import Link from 'next/link';
import Image from 'next/image';
import { Listing, TREE_WIDTH_LABELS } from '@/lib/types';
import FavoriteButton from './FavoriteButton';

export default function SaddleCard({ listing }: { listing: Listing }) {
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
            {TREE_WIDTH_LABELS[listing.tree_width]} Tree
            {listing.location_state ? ` · ${listing.location_state}` : ''}
          </p>
          <p className="font-bold mt-1">{price}</p>
        </div>
      </Link>
    </div>
  );
}
