'use client';

import { useEffect, useState } from 'react';

/**
 * "Where is the saddle?" as one ZIP code box. Looks up the city and state (zippopotam.us, a free
 * public ZIP database) and submits them as hidden location_city / location_state fields, so
 * listings still show "Durham, NC". If a pasted post gave a city/state but no ZIP, those are kept
 * until a ZIP is entered.
 */
export default function ZipField({
  initialZip,
  initialCity,
  initialState,
  className
}: {
  initialZip?: string | null;
  initialCity?: string | null;
  initialState?: string | null;
  className: string;
}) {
  const [zip, setZip] = useState(initialZip ?? '');
  const [city, setCity] = useState(initialCity ?? '');
  const [state, setState] = useState(initialState ?? '');
  const [status, setStatus] = useState<'idle' | 'looking' | 'found' | 'not_found'>(initialZip ? 'found' : 'idle');

  useEffect(() => {
    if (!/^\d{5}$/.test(zip) || zip === initialZip) return;
    let cancelled = false;
    setStatus('looking');
    fetch(`https://api.zippopotam.us/us/${zip}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        const place = json?.places?.[0];
        if (place) {
          setCity(place['place name']);
          setState(place['state abbreviation']);
          setStatus('found');
        } else {
          setStatus('not_found');
        }
      })
      .catch(() => !cancelled && setStatus('not_found'));
    return () => {
      cancelled = true;
    };
  }, [zip, initialZip]);

  const place = [city, state].filter(Boolean).join(', ');

  return (
    <div>
      <label htmlFor="location_zip" className="block text-sm font-semibold mb-1">
        Where is the saddle? (ZIP code)
      </label>
      <input
        id="location_zip"
        name="location_zip"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        pattern="\d{5}"
        title="5-digit ZIP code"
        placeholder="e.g. 27701"
        value={zip}
        onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
        className={`${className} max-w-[10rem]`}
      />
      <input type="hidden" name="location_city" value={city} />
      <input type="hidden" name="location_state" value={state} />
      <p className="text-xs mt-1 text-saddle-muted min-h-[1rem]">
        {status === 'looking' && 'Looking up…'}
        {status === 'found' && place && <span className="text-saddle-green">📍 {place}</span>}
        {status === 'not_found' && <span className="text-red-700">Couldn&apos;t find that ZIP — check the number.</span>}
        {status === 'idle' && place && <>From your post: {place}. Add the ZIP to confirm (optional).</>}
        {status === 'idle' && !place && 'Buyers see the city and state, not the ZIP.'}
      </p>
    </div>
  );
}
