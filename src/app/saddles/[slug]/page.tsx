import { createClient } from '@/lib/supabase/server';
import { TREE_WIDTH_LABELS, DISCIPLINE_LABELS, Listing } from '@/lib/types';
import FavoriteButton from '@/components/FavoriteButton';
import BuyButton from '@/components/BuyButton';
import InquiryBox from '@/components/InquiryBox';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

async function getListing(slug: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('listings')
    .select('*, brands(name, slug)')
    .eq('slug', slug)
    .single();
  return data as unknown as Listing | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const listing = await getListing(params.slug);
  if (!listing) return {};
  const title = `${listing.seat_size}" ${listing.brands?.name} ${listing.model} — ${TREE_WIDTH_LABELS[listing.tree_width]} Tree`;
  return {
    title,
    description:
      listing.meta_description ??
      `${title}, ${DISCIPLINE_LABELS[listing.discipline]} saddle for sale on SaddleUp. Condition: ${listing.condition ?? 'used'}.`,
    openGraph: { images: listing.images?.[0] ? [listing.images[0]] : [] }
  };
}

export default async function ListingPage({ params }: { params: { slug: string } }) {
  const listing = await getListing(params.slug);
  if (!listing) return notFound();

  const price = listing.price_cents / 100;

  // Structured data: helps Google *and* AI answer engines (GEO) surface this
  // exact saddle when someone searches "16.5 medium tree Antares for sale".
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${listing.seat_size}" ${listing.brands?.name} ${listing.model}`,
    description: listing.description,
    image: listing.images,
    brand: { '@type': 'Brand', name: listing.brands?.name },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition'
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Seat Size', value: `${listing.seat_size} in` },
      { '@type': 'PropertyValue', name: 'Tree Width', value: TREE_WIDTH_LABELS[listing.tree_width] },
      { '@type': 'PropertyValue', name: 'Discipline', value: DISCIPLINE_LABELS[listing.discipline] }
    ]
  };

  return (
    <div className="py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="relative aspect-[4/3] bg-white border border-saddle-tan rounded-lg overflow-hidden">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[0]} alt={listing.model} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-saddle-brown/40">No photo yet</div>
        )}
        <FavoriteButton listingId={listing.id} className="absolute top-3 right-3" />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-saddle-brown">
          {listing.seat_size}&quot; {listing.brands?.name} {listing.model}
        </h1>
        <p className="text-3xl font-bold my-3">
          {price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </p>

        <dl className="grid grid-cols-2 gap-y-2 text-sm mb-6">
          <dt className="text-gray-500">Discipline</dt>
          <dd>{DISCIPLINE_LABELS[listing.discipline]}</dd>
          <dt className="text-gray-500">Tree Width</dt>
          <dd>{TREE_WIDTH_LABELS[listing.tree_width]}</dd>
          <dt className="text-gray-500">Panel Type</dt>
          <dd>{listing.panel_type ?? '—'}</dd>
          <dt className="text-gray-500">Condition</dt>
          <dd>{listing.condition ?? '—'}</dd>
          <dt className="text-gray-500">Year</dt>
          <dd>{listing.year_manufactured ?? '—'}</dd>
          <dt className="text-gray-500">Location</dt>
          <dd>{[listing.location_city, listing.location_state].filter(Boolean).join(', ') || '—'}</dd>
        </dl>

        <p className="mb-2">
          <a href={`/sellers/${listing.seller_id}`} className="text-sm underline text-saddle-brown">
            View seller profile & reviews
          </a>
        </p>

        <p className="mb-6 whitespace-pre-line">{listing.description}</p>

        <BuyButton listingId={listing.id} priceCents={listing.price_cents} />
        <InquiryBox listingId={listing.id} sellerId={listing.seller_id} />
      </div>
    </div>
  );
}
