'use client';

import { useEffect, useRef, useState } from 'react';
import ListingForm from './ListingForm';
import PhotoPicker from './sell/PhotoPicker';
import type { EbaySource, ListingPrefill } from '@/lib/ebay/map';
import { readListingText } from '@/lib/read-listing-text';
import { takePendingCheck, uploadReadPhoto, type PickedPhoto } from '@/lib/listing-photos';
import { listingPhotoIndexes, runSaddleCheck, type PriceRange, type SaddleCheck } from '@/lib/saddle-check';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

interface Fill {
  key: string;
  prefill: ListingPrefill;
  images?: string[];
  ebay?: EbaySource;
  note: string;
  missing: string[];
  warnings: string[];
  photoFindings?: string[];
  price?: PriceRange | null;
}

/**
 * Quick-fill panel above the new-listing form: photos of the saddle (read by AI, with a price
 * check), a pasted description, or an eBay listing. Each fills the form; the seller reviews
 * everything and saves.
 */
export default function NewListingWithEbayImport({
  brands,
  ebayEnabled,
  fromHome = false
}: {
  brands: { id: number; name: string }[];
  ebayEnabled: boolean;
  /** Pick up photos chosen on the home page and read them straight away. */
  fromHome?: boolean;
}) {
  const [mode, setMode] = useState<'photos' | 'paste' | 'ebay'>('photos');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fill, setFill] = useState<Fill | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<string | null>(null);
  const started = useRef(false);

  /** A finished check -> the listing form, with the saddle and stamp photos saved to the listing. */
  async function applyCheck(picked: PickedPhoto[], check: SaddleCheck) {
    const { result, price } = check;
    setStep('Adding your photos to the listing…');
    const images = (await Promise.all(listingPhotoIndexes(result, picked.length).map((i) => uploadReadPhoto(picked[i], i)))).filter(
      (u): u is string => !!u
    );
    const p = result.prefill;
    setFill({
      key: `photos-${Date.now()}`,
      // Start from the typical price when the seller hasn't given one; they can change it.
      prefill: { ...p, price: p.price ?? price?.typical ?? null },
      images,
      note: result.found.length ? `From your photos we filled in ${result.found.join(', ')}.` : 'We read your photos.',
      missing: result.missing.filter((m) => !(m === 'price' && price)),
      warnings: result.warnings,
      photoFindings: result.photoFindings,
      price
    });
  }

  /** Photos -> AI reader + price check -> filled form. */
  async function readPhotos(picked: PickedPhoto[], extra = '') {
    setError(null);
    setLoading(true);
    const check = await runSaddleCheck(picked, extra, brands, setStep);
    if ('error' in check) setError(check.error);
    else await applyCheck(picked, check);
    setLoading(false);
    setStep(null);
  }

  // A check done on the home page before signing in: fill the form from it (no second AI read).
  useEffect(() => {
    if (!fromHome || started.current) return;
    started.current = true;
    takePendingCheck().then(async (pending) => {
      if (!pending) return;
      setPhotos(pending.photos);
      if (!pending.result) return readPhotos(pending.photos);
      setLoading(true);
      await applyCheck(pending.photos, { result: pending.result as SaddleCheck['result'], price: pending.price ?? null });
      setLoading(false);
      setStep(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromHome]);

  async function handlePaste(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await readListingText(text, brands);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const { prefill, found, missing, warnings, reader } = result;
    if (!found.length) {
      setError("We couldn't pick out any saddle details — try including the brand, seat size and price.");
      return;
    }
    setFill({
      key: `paste-${Date.now()}`,
      prefill,
      note: `Filled in ${found.join(', ')}${reader === 'ai' ? ' and tidied up the description' : ''}.`,
      missing,
      warnings
    });
  }

  async function handleEbay(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ebay/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Import failed.');
      setFill({
        key: `ebay-${json.source.item_id}`,
        prefill: json.prefill,
        images: json.images,
        ebay: json.source,
        note: `Imported “${json.source.title}” with ${json.images.length} photo${json.images.length === 1 ? '' : 's'}.`,
        missing: json.missing,
        warnings: []
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  }

  const tab = (m: 'photos' | 'paste' | 'ebay', label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      aria-pressed={mode === m}
      className={`px-3 py-1.5 text-sm rounded-sm border ${
        mode === m ? 'bg-saddle-brown text-saddle-cream border-saddle-brown' : 'bg-saddle-paper text-saddle-brown border-saddle-line'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <section className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-5">
        <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold mb-1">Save time</div>
        <h2 className="font-serif text-xl text-saddle-ink mb-3">Fill in the form for me</h2>

        <div className="flex flex-wrap gap-2 mb-3">
          {tab('photos', 'From photos')}
          {tab('paste', 'Paste a description')}
          {ebayEnabled && tab('ebay', 'Import from eBay')}
        </div>

        {mode === 'photos' ? (
          <div className="space-y-3">
            <p className="text-sm text-saddle-muted">
              We&apos;ll read your photos, fill in the listing and tell you what your saddle is worth. You check everything
              before it&apos;s saved.
            </p>
            <PhotoPicker photos={photos} setPhotos={setPhotos} compact />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything else? e.g. the price you have in mind, where it is, what's included (optional)"
              className="w-full border border-saddle-line rounded p-2 bg-saddle-paper text-sm"
            />
            <button
              type="button"
              onClick={() => readPhotos(photos, notes)}
              disabled={loading || !photos.length}
              className="bg-saddle-green text-saddle-cream px-5 py-2 rounded-sm font-semibold disabled:opacity-60"
            >
              {loading ? step ?? 'Reading…' : fill?.photoFindings ? 'Read my photos again' : 'Price my saddle & fill in the listing'}
            </button>
            {loading && <p className="text-xs text-saddle-muted">This takes about 30 seconds.</p>}
          </div>
        ) : mode === 'paste' ? (
          <form onSubmit={handlePaste} className="space-y-2">
            <p className="text-sm text-saddle-muted">
              Paste your ad, Facebook post or notes — we&apos;ll pick out the brand, model, seat size, tree width, price
              and location. You can fix anything before saving.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              required
              placeholder={'e.g. Antares Spirit 17.5" MW tree, 3A flaps. Excellent condition. $2,850 OBO. Wellington, FL'}
              className="w-full border border-saddle-line rounded p-2 bg-saddle-paper text-sm"
            />
            <button type="submit" disabled={loading} className="bg-saddle-green text-saddle-cream px-5 py-2 rounded-sm font-semibold disabled:opacity-60">
              {loading ? 'Reading…' : fill && !fill.ebay ? 'Fill in again' : 'Fill in the form'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEbay} className="space-y-2">
            <p className="text-sm text-saddle-muted">
              Paste the link to your own eBay listing and we&apos;ll fill in the form and copy your photos.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.ebay.com/itm/123456789012"
                required
                className="flex-1 border border-saddle-line rounded p-2 bg-saddle-paper"
              />
              <button type="submit" disabled={loading} className="bg-saddle-green text-saddle-cream px-5 py-2 rounded-sm font-semibold disabled:opacity-60">
                {loading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </form>
        )}

        {error && <p className="text-red-700 text-sm mt-2">{error}</p>}
        {fill?.price && (
          <div className="mt-4 rounded border border-saddle-green bg-saddle-paper p-4">
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold mb-1">What your saddle is worth</div>
            <div className="font-serif text-2xl text-saddle-ink">
              About {usd(fill.price.low)}–{usd(fill.price.high)}
            </div>
            <p className="text-sm text-saddle-body mt-1">{fill.price.reasoning}</p>
            <p className="text-xs text-saddle-muted mt-2">
              An estimate from similar saddles listed right now.{' '}
              {fill.prefill.price === fill.price.typical
                ? `We've set your price to ${usd(fill.price.typical)}; change it below if you like.`
                : `A fair asking price is around ${usd(fill.price.typical)}.`}
            </p>
          </div>
        )}
        {fill?.photoFindings && fill.photoFindings.length > 0 && (
          <ul className="mt-3 text-sm text-saddle-ink space-y-1">
            <li className="font-semibold">Read from your photos:</li>
            {fill.photoFindings.map((f) => (
              <li key={f}>📷 {f}</li>
            ))}
          </ul>
        )}
        {fill && (
          <p className="text-sm text-saddle-green mt-2">
            {fill.note}
            {fill.missing.length > 0 && (
              <span className="text-saddle-brown"> Please add the {fill.missing.join(', ')} below.</span>
            )}
          </p>
        )}
        {fill && fill.warnings.length > 0 && (
          <ul className="mt-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 space-y-1">
            <li className="font-semibold">Double-check before saving (this won't stop you saving):</li>
            {fill.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}
      </section>

      <ListingForm
        // Re-mount on each fill so the form's default values pick up the new data.
        key={fill?.key ?? 'blank'}
        brands={brands}
        prefill={fill?.prefill}
        prefillImages={fill?.images}
        ebaySource={fill?.ebay}
        readerNotes={fill ? { findings: fill.photoFindings ?? [], warnings: fill.warnings, missing: fill.missing ?? [] } : undefined}
      />
    </div>
  );
}
