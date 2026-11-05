'use client';

import { useState } from 'react';
import ListingForm from './ListingForm';
import type { EbaySource, ListingPrefill } from '@/lib/ebay/map';
import { parseListingText } from '@/lib/parse-listing-text';

interface Fill {
  key: string;
  prefill: ListingPrefill;
  images?: string[];
  ebay?: EbaySource;
  note: string;
  missing: string[];
}

/**
 * Quick-fill panel above the new-listing form: paste a description (Facebook post, ad, notes)
 * or import an eBay listing. Either fills the form; the seller reviews everything and saves.
 */
export default function NewListingWithEbayImport({
  brands,
  ebayEnabled
}: {
  brands: { id: number; name: string }[];
  ebayEnabled: boolean;
}) {
  const [mode, setMode] = useState<'paste' | 'ebay'>('paste');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fill, setFill] = useState<Fill | null>(null);

  function handlePaste(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { prefill, found, missing } = parseListingText(text, brands);
    if (!found.length) {
      setError("We couldn't pick out any saddle details — try including the brand, seat size and price.");
      return;
    }
    setFill({
      key: `paste-${Date.now()}`,
      prefill,
      note: `Filled in ${found.join(', ')}.`,
      missing
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
        missing: json.missing
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  }

  const tab = (m: 'paste' | 'ebay', label: string) => (
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

        {ebayEnabled && (
          <div className="flex gap-2 mb-3">
            {tab('paste', 'Paste a description')}
            {tab('ebay', 'Import from eBay')}
          </div>
        )}

        {mode === 'paste' ? (
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
            <button type="submit" className="bg-saddle-green text-saddle-cream px-5 py-2 rounded-sm font-semibold">
              {fill && !fill.ebay ? 'Fill in again' : 'Fill in the form'}
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
        {fill && (
          <p className="text-sm text-saddle-green mt-2">
            {fill.note}
            {fill.missing.length > 0 && (
              <span className="text-saddle-brown"> Please add the {fill.missing.join(', ')} below.</span>
            )}
          </p>
        )}
      </section>

      <ListingForm
        // Re-mount on each fill so the form's default values pick up the new data.
        key={fill?.key ?? 'blank'}
        brands={brands}
        prefill={fill?.prefill}
        prefillImages={fill?.images}
        ebaySource={fill?.ebay}
      />
    </div>
  );
}
