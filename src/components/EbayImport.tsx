'use client';

import { useState } from 'react';
import ListingForm from './ListingForm';
import type { EbaySource, ListingPrefill } from '@/lib/ebay/map';

interface ImportResult {
  prefill: ListingPrefill;
  images: string[];
  source: EbaySource;
  missing: string[];
}

/** "Import from eBay" box above the new-listing form. Fills the form; the seller reviews and saves. */
export default function NewListingWithEbayImport({
  brands,
  ebayEnabled
}: {
  brands: { id: number; name: string }[];
  ebayEnabled: boolean;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleImport(e: React.FormEvent) {
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
      setResult(json as ImportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {ebayEnabled && (
        <section className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-5">
          <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold mb-1">Already listed on eBay?</div>
          <h2 className="font-serif text-xl text-saddle-ink mb-1">Import your listing</h2>
          <p className="text-sm text-saddle-muted mb-3">
            Paste the link to your own eBay listing and we&apos;ll fill in the form and copy your photos. You can edit
            everything before saving.
          </p>
          <form onSubmit={handleImport} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.ebay.com/itm/123456789012"
              required
              className="flex-1 border border-saddle-line rounded p-2 bg-saddle-paper"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-saddle-green text-saddle-cream px-5 py-2 rounded-sm font-semibold disabled:opacity-60"
            >
              {loading ? 'Importing…' : result ? 'Import another' : 'Import'}
            </button>
          </form>
          {error && <p className="text-red-700 text-sm mt-2">{error}</p>}
          {result && (
            <p className="text-sm text-saddle-green mt-2">
              Imported “{result.source.title}” with {result.images.length} photo{result.images.length === 1 ? '' : 's'}.
              {result.missing.length > 0 && (
                <span className="text-saddle-brown">
                  {' '}
                  We couldn&apos;t tell the {result.missing.join(', ')} — please fill {result.missing.length === 1 ? 'it' : 'those'} in below.
                </span>
              )}
            </p>
          )}
        </section>
      )}

      <ListingForm
        // Re-mount on each import so the form's default values pick up the new data.
        key={result?.source.item_id ?? 'blank'}
        brands={brands}
        prefill={result?.prefill}
        prefillImages={result?.images}
        ebaySource={result?.source}
      />
    </div>
  );
}
