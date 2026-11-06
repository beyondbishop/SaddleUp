// POST /api/shipping/quote { listingId, zip }
// Real carrier price to ship this saddle to the buyer's ZIP: ground service, signature on
// delivery, insured for the full price. Checkout charges exactly this quote.
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { parcelFor, quoteByZip, shippoConfigured } from '@/lib/shippo';
import { isUuid } from '@/lib/lists-server';

export const dynamic = 'force-dynamic';

const QUOTE_HOURS = 24;

export async function POST(req: Request) {
  if (!shippoConfigured()) return NextResponse.json({ error: 'Shipping quotes are unavailable right now.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const zip = typeof body.zip === 'string' ? body.zip.trim().slice(0, 5) : '';
  if (!isUuid(body.listingId)) return NextResponse.json({ error: 'Saddle not found.' }, { status: 404 });
  if (!/^\d{5}$/.test(zip)) return NextResponse.json({ error: 'Enter a 5-digit US ZIP code.' }, { status: 400 });

  const {
    data: { user }
  } = await createClient().auth.getUser();
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from('listings')
    .select('id, status, price_cents, location_zip, pkg_length_in, pkg_width_in, pkg_height_in, pkg_weight_lb')
    .eq('id', body.listingId)
    .maybeSingle();
  if (!listing || !['active', 'pending_sale'].includes(listing.status)) {
    return NextResponse.json({ error: 'This saddle is no longer available.' }, { status: 404 });
  }
  if (!listing.location_zip) {
    return NextResponse.json({ error: 'The seller hasn’t added their ZIP code yet, so we can’t quote shipping. Ask the seller a question below.' }, { status: 422 });
  }

  // Reuse a recent quote for the same saddle and ZIP (prices don't change minute to minute).
  const { data: recent } = await admin
    .from('shipping_quotes')
    .select('id, amount_cents, service_name, estimated_days, buyer_id, insured_cents')
    .eq('listing_id', listing.id)
    .eq('to_zip', zip)
    .gt('expires_at', new Date(Date.now() + 3600 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent && recent.insured_cents === listing.price_cents && (!recent.buyer_id || recent.buyer_id === user?.id)) {
    return NextResponse.json({ quoteId: recent.id, amountCents: recent.amount_cents, service: recent.service_name, days: recent.estimated_days, zip });
  }

  const parcel = parcelFor(listing);
  let rate;
  try {
    rate = await quoteByZip(listing.location_zip, zip, parcel, listing.price_cents);
  } catch (e) {
    console.error('Shipping quote failed', e);
    return NextResponse.json({ error: 'We couldn’t get a shipping price just now. Please try again.' }, { status: 502 });
  }
  if (!rate) return NextResponse.json({ error: 'No ground shipping is available to that ZIP. Ask the seller about delivery.' }, { status: 422 });

  const { data: quote, error } = await admin
    .from('shipping_quotes')
    .insert({
      listing_id: listing.id,
      buyer_id: user?.id ?? null,
      to_zip: zip,
      from_zip: listing.location_zip,
      amount_cents: rate.amountCents,
      carrier: rate.carrier,
      service_token: rate.serviceToken,
      service_name: rate.serviceName,
      estimated_days: rate.estimatedDays,
      insured_cents: listing.price_cents,
      parcel,
      expires_at: new Date(Date.now() + QUOTE_HOURS * 3600 * 1000).toISOString()
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: 'Could not save the quote.' }, { status: 500 });

  return NextResponse.json({ quoteId: quote.id, amountCents: rate.amountCents, service: rate.serviceName, days: rate.estimatedDays, zip });
}
