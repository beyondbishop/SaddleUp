// Shippo: shipping quotes, labels and tracking. Server-only (uses the secret token).
// SHIPPO_API_TOKEN decides test vs live; test labels are free and test tracking numbers
// (carrier "shippo": SHIPPO_TRANSIT, SHIPPO_DELIVERED, SHIPPO_FAILURE) simulate deliveries.

const API = 'https://api.goshippo.com';

export function shippoConfigured() {
  return !!process.env.SHIPPO_API_TOKEN;
}

async function shippo<T = any>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `ShippoToken ${process.env.SHIPPO_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Shippo ${method} ${path} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json as T;
}

export interface Parcel { length: number; width: number; height: number; weight: number }

/** A typical packed saddle. Sellers can enter their own box on the listing. */
export const DEFAULT_PARCEL: Parcel = { length: 28, width: 20, height: 14, weight: 25 };

export function parcelFor(l: { pkg_length_in?: number | null; pkg_width_in?: number | null; pkg_height_in?: number | null; pkg_weight_lb?: number | null } | null | undefined): Parcel {
  return {
    length: Number(l?.pkg_length_in) || DEFAULT_PARCEL.length,
    width: Number(l?.pkg_width_in) || DEFAULT_PARCEL.width,
    height: Number(l?.pkg_height_in) || DEFAULT_PARCEL.height,
    weight: Number(l?.pkg_weight_lb) || DEFAULT_PARCEL.weight
  };
}

const shippoParcel = (p: Parcel) => ({
  length: String(p.length), width: String(p.width), height: String(p.height), distance_unit: 'in',
  weight: String(p.weight), mass_unit: 'lb'
});

/**
 * Signature on delivery and insurance for the saddle's full value (the sale price), on every
 * outbound shipment. Shippo includes the cost of both in each rate's amount, so the quote the
 * buyer sees already covers them.
 */
const extras = (insuredCents: number) => ({
  signature_confirmation: 'STANDARD',
  insurance: { amount: (insuredCents / 100).toFixed(2), currency: 'USD', content: 'Used saddle' }
});

// UPS and FedEx are the carriers we want: ground first, cheapest wins. Overnight/express aren't offered.
const OFFERED = ['ups_ground', 'fedex_ground', 'fedex_home_delivery', 'ups_3_day_select', 'fedex_express_saver'];
const OFFERED_CARRIERS = ['ups', 'fedex'];
// TEMPORARY fallback until UPS/FedEx are enabled on the Shippo account (UPS needs Shippo's approval,
// FedEx isn't connected yet). USPS is used only when Shippo returns no UPS/FedEx rate at all, so it
// switches to UPS/FedEx by itself once they're connected. Same signature + full-value insurance.
const FALLBACK = ['usps_ground_advantage', 'usps_priority'];
const FALLBACK_CARRIERS = ['usps'];

export interface Rate {
  objectId: string;
  amountCents: number;
  carrier: string;
  serviceToken: string;
  serviceName: string;
  estimatedDays: number | null;
}

function pickRate(rates: any[], preferredToken?: string | null): Rate | null {
  const pickFrom = (tokens: string[], carriers: string[]) =>
    (rates ?? []).filter(
      (r) => tokens.includes(r.servicelevel?.token) && carriers.includes(String(r.provider ?? '').toLowerCase())
    );
  const primary = pickFrom(OFFERED, OFFERED_CARRIERS);
  const usable = primary.length ? primary : pickFrom(FALLBACK, FALLBACK_CARRIERS);
  // A USPS quote never forces a USPS label once UPS/FedEx rates exist: the preferred service
  // is only looked for among the rates we'd use anyway.
  const preferred = preferredToken ? usable.find((r) => r.servicelevel?.token === preferredToken) : null;
  const best = preferred ?? usable.sort((a, b) => Number(a.amount) - Number(b.amount))[0];
  if (!best) return null;
  return {
    objectId: best.object_id,
    amountCents: Math.round(Number(best.amount) * 100),
    carrier: best.provider,
    serviceToken: best.servicelevel.token,
    serviceName: `${best.provider} ${best.servicelevel.name ?? ''}`.trim(),
    estimatedDays: best.estimated_days ?? null
  };
}

/** Cheapest UPS/FedEx service between two ZIPs, signature required, insured for the saddle's value. */
export async function quoteByZip(fromZip: string, toZip: string, parcel: Parcel, insuredCents: number): Promise<Rate | null> {
  const shipment = await shippo('POST', '/shipments/', {
    address_from: { zip: fromZip, country: 'US' },
    address_to: { zip: toZip, country: 'US' },
    parcels: [shippoParcel(parcel)],
    extra: extras(insuredCents),
    async: false
  });
  return pickRate(shipment.rates, null);
}

export interface Address {
  name: string; street1: string; street2?: string | null; city: string; state: string; zip: string; phone?: string | null; email?: string | null;
}

export interface Label {
  shipmentId: string; transactionId: string; trackingNumber: string; trackingUrl: string | null; labelUrl: string;
  carrier: string; serviceToken: string; costCents: number;
}

/** Buy the outbound label (same service the buyer was quoted when it's still offered). */
export async function buyLabel(from: Address, to: Address, parcel: Parcel, insuredCents: number, preferredService?: string | null): Promise<Label> {
  const shipment = await shippo('POST', '/shipments/', {
    address_from: { ...from, country: 'US' },
    address_to: { ...to, country: 'US' },
    parcels: [shippoParcel(parcel)],
    extra: extras(insuredCents),
    async: false
  });
  const rate = pickRate(shipment.rates, preferredService);
  if (!rate) {
    const why = (shipment.messages ?? []).map((m: any) => m.text).join(' ');
    throw new Error(`No shipping service available for these addresses. ${why}`.trim());
  }
  const tx = await shippo('POST', '/transactions/', { rate: rate.objectId, label_file_type: 'PDF_4x6', async: false });
  if (tx.status !== 'SUCCESS') {
    throw new Error((tx.messages ?? []).map((m: any) => m.text).join(' ') || 'The carrier didn’t accept the label.');
  }
  return {
    shipmentId: shipment.object_id,
    transactionId: tx.object_id,
    trackingNumber: tx.tracking_number,
    trackingUrl: tx.tracking_url_provider ?? null,
    labelUrl: tx.label_url,
    carrier: rate.carrier.toLowerCase(),
    serviceToken: rate.serviceToken,
    costCents: rate.amountCents
  };
}

/** Shippo carrier code for a carrier name entered by a seller. */
export function carrierCode(name: string) {
  const n = name.toLowerCase();
  if (n === 'ups') return 'ups';
  if (n === 'fedex') return 'fedex';
  if (n === 'usps') return 'usps';
  if (n === 'dhl') return 'dhl_express';
  if (n === 'shippo') return 'shippo'; // test tracking numbers
  return null;
}

export type TrackStatus = 'UNKNOWN' | 'PRE_TRANSIT' | 'TRANSIT' | 'DELIVERED' | 'RETURNED' | 'FAILURE';

export interface Track {
  status: TrackStatus;
  statusDate: string | null;
  /** First time the carrier had it (first TRANSIT scan). */
  firstTransitAt: string | null;
  deliveredAt: string | null;
}

export async function getTrack(carrier: string, trackingNumber: string): Promise<Track> {
  const t = await shippo('GET', `/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`);
  const history: any[] = t.tracking_history ?? [];
  const firstTransit = history.find((h) => h.status === 'TRANSIT' || h.status === 'DELIVERED');
  const status = (t.tracking_status?.status ?? 'UNKNOWN') as TrackStatus;
  return {
    status,
    statusDate: t.tracking_status?.status_date ?? null,
    firstTransitAt: firstTransit?.status_date ?? (status === 'TRANSIT' ? t.tracking_status?.status_date : null) ?? null,
    deliveredAt: status === 'DELIVERED' ? t.tracking_status?.status_date ?? null : null
  };
}

/** Ask Shippo to send tracking updates for a number we didn't buy through Shippo. */
export async function registerTrack(carrier: string, trackingNumber: string, orderId: string) {
  await shippo('POST', '/tracks/', { carrier, tracking_number: trackingNumber, metadata: `order ${orderId}` });
}
