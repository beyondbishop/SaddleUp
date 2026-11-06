'use client';

import { useState } from 'react';
import ListingForm from './ListingForm';
import type { ParsedListing } from '@/lib/parse-listing-text';
import { readListingText } from '@/lib/read-listing-text';
import { claimMessage } from '@/lib/claim-message';
import CopyButton from '@/components/imports/CopyButton';
import MarkMessagedButton from '@/components/imports/MarkMessagedButton';
import Link from 'next/link';

interface Created {
  id: string;
  saddle: string;
  sellerName: string;
  sourceUrl: string;
  claimUrl: string;
  message: string;
}

export default function AdminQuickAdd({ brands, siteUrl }: { brands: { id: number; name: string }[]; siteUrl: string }) {
  const [text, setText] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [parsed, setParsed] = useState<(ParsedListing & { key: string; reader: 'ai' | 'rules' }) | null>(null);
  const [created, setCreated] = useState<Created[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  async function fill(e: React.FormEvent) {
    e.preventDefault();
    setReading(true);
    const result = await readListingText(text, brands);
    setReading(false);
    if (!result.found.length) {
      setError("Couldn't pick out any saddle details from that text.");
      return;
    }
    setError(null);
    setParsed({ ...result, key: String(Date.now()) });
  }

  function reset() {
    setText('');
    setSellerName('');
    setSourceUrl('');
    setParsed(null);
  }

  const latest = created[0];

  return (
    <div className="space-y-8">
      {latest && !parsed && (
        <section className="max-w-2xl bg-saddle-paper border border-saddle-green rounded p-5 space-y-3">
          <p className="font-serif text-xl text-saddle-ink">✓ Hidden listing created: {latest.saddle}</p>
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.14em] text-saddle-gold mb-1">Claim link</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-sm break-all">{latest.claimUrl}</code>
              <CopyButton text={latest.claimUrl} label="Copy link" />
            </div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.14em] text-saddle-gold mb-1">Message to send</div>
            <p className="text-sm whitespace-pre-wrap bg-saddle-sand border border-saddle-line rounded p-3 mb-2">{latest.message}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={latest.message} label="Copy message" />
              {latest.sourceUrl && (
                <a href={latest.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline text-saddle-brown self-center">
                  Open their post to message them
                </a>
              )}
              <MarkMessagedButton listingId={latest.id} messagedAt={null} />
            </div>
            <p className="text-xs text-saddle-muted mt-2">
              Every saddle you add is on <Link href="/imports" className="underline">My imports</Link>, so you can come back to it.
            </p>
          </div>
        </section>
      )}

      {!parsed ? (
        <form onSubmit={fill} className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-5 space-y-3">
          <h2 className="font-serif text-xl text-saddle-ink">{created.length ? 'Add another' : 'Paste the post'}</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            required
            placeholder={'e.g. Devoucoux Biarritz 17 1/2 seat 2A flap, med tree, black. 3.3k. Ocala, Florida'}
            className="w-full border border-saddle-line rounded p-2 bg-saddle-paper text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
              placeholder="Seller's name (for the message)"
              className="border border-saddle-line rounded p-2 bg-saddle-paper text-sm"
            />
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Link to their post (optional)"
              className="border border-saddle-line rounded p-2 bg-saddle-paper text-sm"
            />
          </div>
          {error && <p className="text-red-700 text-sm">{error}</p>}
          <button type="submit" disabled={reading} className="bg-saddle-green text-saddle-cream px-5 py-2 rounded-sm font-semibold disabled:opacity-60">
            {reading ? 'Reading…' : 'Fill in details'}
          </button>
        </form>
      ) : (
        <section className="space-y-3">
          <div className="max-w-2xl flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-saddle-green">
              Filled in {parsed.found.join(', ')}{parsed.reader === 'ai' ? ' and tidied up the description' : ''}.
              {parsed.missing.length > 0 && <span className="text-saddle-brown"> Please add the {parsed.missing.join(', ')}.</span>}
            </p>
            <button type="button" onClick={() => setParsed(null)} className="text-sm underline text-saddle-brown">
              ← Back to the pasted text
            </button>
          </div>
          {parsed.warnings.length > 0 && (
            <ul className="max-w-2xl text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 space-y-1">
              <li className="font-semibold">Double-check before saving (this won't stop you saving):</li>
              {parsed.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
          <ListingForm
            key={parsed.key}
            brands={brands}
            prefill={parsed.prefill}
            importMeta={{ sourceUrl, sellerName }}
            onSeeded={({ id, claim_token, saddle }) => {
              const claimUrl = `${siteUrl.replace(/\/$/, '')}/claim/${claim_token}`;
              setCreated((prev) => [
                { id, saddle, sellerName, sourceUrl, claimUrl, message: claimMessage(sellerName, saddle, claimUrl) },
                ...prev
              ]);
              reset();
            }}
          />
        </section>
      )}

      {created.length > 1 && (
        <section className="max-w-2xl">
          <h2 className="font-serif text-xl text-saddle-ink mb-2">Added this session</h2>
          <ul className="divide-y divide-saddle-line border border-saddle-line rounded bg-saddle-paper">
            {created.map((c) => (
              <li key={c.claimUrl} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <strong>{c.saddle}</strong>
                  {c.sellerName ? ` · ${c.sellerName}` : ''}
                </span>
                <span className="flex flex-wrap gap-2 items-center">
                  <CopyButton text={c.message} label="Copy message" />
                  <MarkMessagedButton listingId={c.id} messagedAt={null} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
