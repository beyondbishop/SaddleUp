import { createClient, createAdminClient } from '@/lib/supabase/server';
import OrderProgress from '@/components/orders/OrderProgress';
import { orderStage, publicSaleLabel } from '@/lib/order-rules';
import FairPriceRange from '@/components/FairPriceRange';
import { TREE_WIDTH_LABELS, DISCIPLINE_LABELS, PANEL_FLOCKING_LABELS, TRIAL_POLICY_LABELS, Listing } from '@/lib/types';
import FavoriteButton from '@/components/FavoriteButton';
import PhotoGallery from '@/components/PhotoGallery';
import { SITE_URL, disciplinePath } from '@/lib/seo';
import ViewTracker from '@/components/ViewTracker';
import BuyButton from '@/components/BuyButton';
import InquiryBox from '@/components/InquiryBox';
import type { Metadata } from 'next';
import { CONDITION_LABELS, isForSale, type Condition } from '@/lib/search';
import { getViewer } from '@/lib/roles';

const NotStated = () => <span className="text-gray-500 italic">Not stated</span>;
import { notFound } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { getSellerFace } from '@/lib/avatar';

async function getListing(slug: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('listings')
    .select('*, brands(name, slug)')
    .eq('slug', slug)
    .single();
  if (data) return data as unknown as Listing;
  // Sold saddles stay public (On Trial, then Sold), but row-level security only shows shoppers
  // listings that are for sale, so read sold ones with the service key. Nothing else.
  const { data: sold } = await createAdminClient()
    .from('listings')
    .select('*, brands(name, slug)')
    .eq('slug', slug)
    .eq('status', 'sold')
    .maybeSingle();
  return sold as unknown as Listing | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const listing = await getListing(params.slug);
  if (!listing) return {};
  const title = `${listing.seat_size}" ${listing.brands?.name} ${listing.model}${listing.tree_width ? ` — ${TREE_WIDTH_LABELS[listing.tree_width]} Tree` : ''}`;
  return {
    title,
    description:
      listing.meta_description ??
      `${title}, ${DISCIPLINE_LABELS[listing.discipline]} saddle for sale on SaddleUp. Condition: ${listing.condition ?? 'used'}.`,
    alternates: { canonical: `/saddles/${listing.slug}` },
    openGraph: { images: listing.images?.[0] ? [listing.images[0]] : [] },
    // Only live listings belong in search results. Unclaimed saddles stay out of Google until
    // their seller has claimed them.
    robots: listing.status === 'active' ? undefined : { index: false, follow: false }
  };
}

export default async function ListingPage({ params }: { params: { slug: string } }) {
  const listing = await getListing(params.slug);
  if (!listing) return notFound();

  const price = listing.price_cents / 100;

  // Owners and admins can open listings that aren't public yet; tell them so.
  const { user, isAdmin } = await getViewer();
  // The sale behind a sold saddle (orders are private, so read with the service key and only
  // show the buyer/seller the details).
  const order =
    listing.status === 'sold'
      ? (
          await createAdminClient()
            .from('orders')
            .select('id, buyer_id, seller_id, status, payout_status, shipped_at, delivered_at, release_at, kept_at, confirmed_at, issue_type, review_status, dispatch_due_at, created_at')
            .eq('listing_id', listing.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        ).data
      : null;
  // Shoppers see "On Trial" while the sale is in progress, then "Sold".
  const saleLabel = order ? publicSaleLabel(orderStage(order)) : null;
  const orderRole: 'buyer' | 'seller' | 'admin' | null = !order || !user
    ? null
    : user.id === order.buyer_id
      ? 'buyer'
      : user.id === order.seller_id
        ? 'seller'
        : isAdmin
          ? 'admin'
          : null;

  // A saddle mid-checkout (pending_sale) is still public; it just can't be bought by others.
  // A sold saddle stays public too, marked On Trial / Sold.
  const notPublic = !isForSale(listing) && listing.status !== 'pending_sale' && !saleLabel;
  // Unclaimed but shown: the seller hasn't joined yet, so shoppers message SaddleUp instead.
  const awaitingSeller = listing.status === 'unclaimed' && !notPublic;
  const canEdit = !!user && (listing.seller_id === user.id || notPublic || isAdmin);
  const seller = await getSellerFace(listing.seller_id);

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
      availability:
        listing.status === 'active' || awaitingSeller
          ? 'https://schema.org/InStock'
          : listing.status === 'sold'
            ? 'https://schema.org/SoldOut'
            : 'https://schema.org/LimitedAvailability',
      url: `${SITE_URL}/saddles/${listing.slug}`,
      // "New / never used" saddles are new; everything else on SaddleUp is used.
      itemCondition: listing.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition'
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Seat Size', value: `${listing.seat_size} in` },
      ...(listing.tree_width ? [{ '@type': 'PropertyValue', name: 'Tree Width', value: TREE_WIDTH_LABELS[listing.tree_width] }] : []),
      { '@type': 'PropertyValue', name: 'Discipline', value: DISCIPLINE_LABELS[listing.discipline] }
    ]
  };

  return (
    <div className="py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      {(notPublic || canEdit || (awaitingSeller && isAdmin)) && (
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 bg-saddle-sand border border-saddle-line rounded p-3 text-sm">
          <span>
            {notPublic
              ? listing.status === 'draft'
                ? 'Waiting for review — only you and SaddleUp admins can see this listing.'
                : `This listing is ${listing.status.replace('_', ' ')} and isn't public.`
              : awaitingSeller
                ? 'Not claimed yet. It shows on the site, and messages about it come to you.'
                : 'This is your listing.'}
          </span>
          {canEdit && (
            <a href={`/dashboard/listings/${listing.id}/edit`} className="underline font-semibold text-saddle-brown">
              Edit listing
            </a>
          )}
        </div>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {isForSale(listing) && <ViewTracker listingId={listing.id} />}

      <div className="space-y-4 min-w-0">
      <PhotoGallery images={listing.images ?? []} alt={`${listing.seat_size}" ${listing.brands?.name ?? ''} ${listing.model}`}>
        <FavoriteButton listingId={listing.id} className="absolute top-3 right-3" />
      </PhotoGallery>

      {listing.video_url && (
        <video
          src={listing.video_url}
          controls
          playsInline
          preload="metadata"
          poster={listing.images?.[0]}
          aria-label={`Video of the ${listing.seat_size}" ${listing.brands?.name ?? ''} ${listing.model}`}
          className="w-full max-h-[28rem] rounded bg-black"
        />
      )}
      </div>

      <div>
        {saleLabel && (
          <span
            className={`inline-block mb-2 px-3 py-1 rounded-full text-sm font-semibold ${
              saleLabel === 'On Trial' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-saddle-brown text-white'
            }`}
          >
            {saleLabel}
          </span>
        )}
        <h1 className="text-2xl font-bold text-saddle-brown">
          {listing.seat_size}&quot; {listing.brands?.name} {listing.model}
        </h1>
        <p className="text-3xl font-bold my-3">
          {price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </p>
        <FairPriceRange price={price} low={(listing as any).price_range_low ?? null} high={(listing as any).price_range_high ?? null} />

        <dl className="grid grid-cols-2 gap-y-2 text-sm mb-6">
          <dt className="text-gray-500">Discipline</dt>
          <dd>
            <a href={disciplinePath(listing.discipline)} className="underline hover:text-saddle-brown">
              {DISCIPLINE_LABELS[listing.discipline]}
            </a>
          </dd>
          <dt className="text-gray-500">Tree Width</dt>
          <dd>
            {listing.tree_width ? (
              <>{TREE_WIDTH_LABELS[listing.tree_width]} <span className="text-gray-500 text-xs">(seller-reported)</span></>
            ) : canEdit ? (
              <span className="text-sm">
                <NotStated />{' '}
                <a href="/guides/how-to-measure-a-saddle#tree" className="underline text-saddle-brown">How to find it</a>
                {' · '}
                <a href={`/dashboard/listings/${listing.id}/edit`} className="underline text-saddle-brown">Add it</a>
              </span>
            ) : (
              <NotStated />
            )}
          </dd>
          <dt className="text-gray-500">Leather Color</dt>
          <dd className="capitalize">{listing.color ?? <NotStated />}</dd>
          <dt className="text-gray-500">Panels</dt>
          <dd>{listing.panel_flocking ? PANEL_FLOCKING_LABELS[listing.panel_flocking] : <NotStated />}</dd>
          <dt className="text-gray-500">Flap / Panel</dt>
          <dd>{listing.panel_type ?? <NotStated />}</dd>
          <dt className="text-gray-500">Condition</dt>
          <dd>{listing.condition ? CONDITION_LABELS[listing.condition as Condition] ?? listing.condition : <NotStated />}</dd>
          <dt className="text-gray-500">Year</dt>
          <dd>{listing.year_manufactured ?? <NotStated />}</dd>
          <dt className="text-gray-500">Location</dt>
          <dd>{[listing.location_city, listing.location_state].filter(Boolean).join(', ') || <NotStated />}</dd>
          <dt className="text-gray-500">Trials</dt>
          <dd>{listing.trial_policy ? TRIAL_POLICY_LABELS[listing.trial_policy as keyof typeof TRIAL_POLICY_LABELS] : 'Ask the seller'}</dd>
        </dl>

        {seller ? (
          <a href={`/sellers/${seller.id}`} className="group flex items-center gap-3 mb-4 p-3 bg-white border border-saddle-line rounded-lg hover:border-saddle-brown transition-colors">
            <Avatar url={seller.avatarUrl} initials={seller.initials} size={56} />
            <span>
              <span className="block text-xs text-saddle-muted">Sold by</span>
              <span className="block font-semibold text-saddle-ink">{seller.firstName}</span>
              <span className="block text-sm underline text-saddle-brown">View profile & reviews</span>
            </span>
          </a>
        ) : listing.seller_id ? (
          <p className="mb-2">
            <a href={`/sellers/${listing.seller_id}`} className="text-sm underline text-saddle-brown">View seller profile & reviews</a>
          </p>
        ) : null}

        <p className="mb-6 whitespace-pre-line">{listing.description}</p>

        {awaitingSeller ? (
          <div className="bg-saddle-sand border border-saddle-line rounded-lg p-4">
            <p className="font-semibold text-saddle-ink">Interested in this saddle?</p>
            <p className="text-sm text-saddle-muted mt-1">
              Send us a message. We&apos;ll pass it to the seller and get back to you with their answer.
            </p>
            <InquiryBox listingId={listing.id} sellerId={null} buttonLabel="Message about this saddle" />
          </div>
        ) : saleLabel ? (
          <div className="bg-white border border-saddle-line rounded-lg p-4 space-y-3">
            {orderRole ? (
              <>
                <p className="font-semibold text-saddle-ink">
                  {orderRole === 'buyer' ? 'Your purchase' : orderRole === 'seller' ? 'Your sale' : 'Sale progress'}
                </p>
                <OrderProgress order={order!} role={orderRole} />
                <a
                  href={orderRole === 'buyer' ? `/orders/${order!.id}` : `/sales/${order!.id}`}
                  className="inline-block text-sm underline font-semibold text-saddle-brown"
                >
                  {orderRole === 'buyer' ? 'Go to your order' : 'Go to the sale'}
                </a>
              </>
            ) : (
              <p className="text-sm text-saddle-muted">
                {saleLabel === 'On Trial'
                  ? 'This saddle has sold and is with its buyer for a 5-day trial. If they send it back, it could be listed again.'
                  : 'This saddle has sold.'}{' '}
                <a href="/saddles" className="underline text-saddle-brown">Browse similar saddles</a>
              </p>
            )}
          </div>
        ) : (
          <>
            <BuyButton listingId={listing.id} priceCents={listing.price_cents} status={listing.status} />
            <InquiryBox listingId={listing.id} sellerId={listing.seller_id} />
          </>
        )}
      </div>
    </div>
  );
}
