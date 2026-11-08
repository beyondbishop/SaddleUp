// How far a saddle is from the shopper. Server-only: uses the bundled US ZIP database
// (zipcodes package: ZIP -> latitude/longitude), so there are no outside calls.
//
// Where the shopper is, in order: a ZIP they typed in the filters (?near=), the ZIP they typed
// last time (su_zip cookie), their own ZIP if signed in (profile, ship-from address, or their
// newest listing), then roughly where Vercel says their connection is (often 50-150 miles off).
import 'server-only';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const zipcodes: {
  lookup(zip: string): { latitude: number; longitude: number; city: string; state: string } | undefined;
  lookupByName(city: string, state: string): { latitude: number; longitude: number }[];
} = require('zipcodes');

export type Point = { lat: number; lng: number };
export type ViewerLocation = Point & { zip: string | null; label: string; source: 'typed' | 'saved' | 'member' | 'ip' };

export const DISTANCE_OPTIONS = [25, 50, 100, 250, 500] as const;
export const ZIP_COOKIE = 'su_zip';

const zipRe = /^\d{5}$/;

export function pointForZip(zip: string | null | undefined): Point | null {
  if (!zip || !zipRe.test(zip)) return null;
  const z = zipcodes.lookup(zip);
  return z ? { lat: z.latitude, lng: z.longitude } : null;
}

export function placeForZip(zip: string): string | null {
  const z = zipRe.test(zip) ? zipcodes.lookup(zip) : undefined;
  return z ? `${z.city}, ${z.state}` : null;
}

/** A listing's spot: its ZIP, or the middle of its city when it only has city + state. */
export function pointForListing(l: { location_zip?: string | null; location_city?: string | null; location_state?: string | null }): Point | null {
  const byZip = pointForZip(l.location_zip);
  if (byZip) return byZip;
  if (!l.location_city || !l.location_state) return null;
  const places = zipcodes.lookupByName(l.location_city.trim(), l.location_state.trim().toUpperCase());
  if (!places?.length) return null;
  return {
    lat: places.reduce((s, p) => s + p.latitude, 0) / places.length,
    lng: places.reduce((s, p) => s + p.longitude, 0) / places.length
  };
}

/** Straight-line miles between two points. */
export function milesBetween(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export function viewerLocation(opts: { typed?: string | null; saved?: string | null; member?: string | null; headers: Headers }): ViewerLocation | null {
  for (const [zip, source] of [[opts.typed, 'typed'], [opts.saved, 'saved'], [opts.member, 'member']] as const) {
    const p = pointForZip(zip);
    if (p && zip) return { ...p, zip, label: placeForZip(zip) ?? zip, source };
  }
  const lat = Number(opts.headers.get('x-vercel-ip-latitude'));
  const lng = Number(opts.headers.get('x-vercel-ip-longitude'));
  if (!opts.headers.get('x-vercel-ip-latitude') || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (opts.headers.get('x-vercel-ip-country') && opts.headers.get('x-vercel-ip-country') !== 'US') return null;
  const ipZip = opts.headers.get('x-vercel-ip-postal-code');
  const city = decodeURIComponent(opts.headers.get('x-vercel-ip-city') ?? '');
  const region = opts.headers.get('x-vercel-ip-country-region');
  return {
    lat, lng,
    zip: ipZip && zipRe.test(ipZip) ? ipZip : null,
    label: city && region ? `${city}, ${region}` : 'your area',
    source: 'ip'
  };
}

export function formatMiles(mi: number): string {
  return mi < 10 ? 'Under 10 mi away' : `${Math.round(mi / 5) * 5} mi away`;
}

/** A signed-in member's own ZIP: the one on their profile, else their ship-from address, else their newest listing's. */
export async function memberZip(supabase: any, user: { id: string; user_metadata?: Record<string, any> } | null): Promise<string | null> {
  if (!user) return null;
  const own = user.user_metadata?.home_zip;
  if (typeof own === 'string' && zipRe.test(own)) return own;
  const [{ data: profile }, { data: listing }] = await Promise.all([
    supabase.from('profiles').select('ship_from').eq('id', user.id).maybeSingle(),
    supabase.from('listings').select('location_zip').eq('seller_id', user.id).not('location_zip', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
  ]);
  const shipZip = String(profile?.ship_from?.zip ?? '').slice(0, 5);
  if (zipRe.test(shipZip)) return shipZip;
  return listing?.location_zip && zipRe.test(listing.location_zip) ? listing.location_zip : null;
}
