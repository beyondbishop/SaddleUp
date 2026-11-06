// Server-only: find a ZIP code for a US city + state when a post gives the town but no ZIP.
// Uses zippopotam.us (the same free ZIP database the listing form's ZIP box uses). A city can
// have many ZIPs; the first one is close enough for showing the location and shipping quotes,
// and the importer or seller can change it.

import 'server-only';

export async function zipForCity(city: string | null | undefined, state: string | null | undefined): Promise<string | null> {
  if (!city?.trim() || !state || !/^[A-Z]{2}$/.test(state)) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${state.toLowerCase()}/${encodeURIComponent(city.trim().toLowerCase())}`, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 60 * 60 * 24 * 30 }
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { places?: { 'post code'?: string }[] };
    const zip = json.places?.map((p) => p['post code']).filter((z): z is string => !!z && /^\d{5}$/.test(z)).sort()[0];
    return zip ?? null;
  } catch {
    return null;
  }
}
