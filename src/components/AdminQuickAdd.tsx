'use client';

import { useEffect, useRef, useState } from 'react';
import ListingForm from './ListingForm';
import type { ParsedListing } from '@/lib/parse-listing-text';
import { readListingText, type ReadPhoto } from '@/lib/read-listing-text';
import { claimMessage, type ClaimTips } from '@/lib/claim-message';
import CopyButton from '@/components/imports/CopyButton';
import SellerMessageCard from '@/components/imports/SellerMessageCard';
import Link from 'next/link';

const MAX_READ_PHOTOS = 6;
const READ_SIDE = 1568; // Claude reads images at up to about this size, enough for a stamp close-up

/** Shrinks a photo in the browser to a JPEG for the reader. It is never uploaded to storage. */
async function toReadPhoto(file: File): Promise<ReadPhoto & { preview: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, READ_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let url = '';
  for (const quality of [0.85, 0.7, 0.55]) {
    url = canvas.toDataURL('image/jpeg', quality);
    if (url.length < 700_000) break;
  }
  return { media_type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1), preview: url };
}

/** Saves a read photo to listing storage so it can go on the listing. */
async function uploadReadPhoto(photo: ReadPhoto, i: number): Promise<string | null> {
  try {
    const bytes = Uint8Array.from(atob(photo.data), (c) => c.charCodeAt(0));
    const body = new FormData();
    body.append('file', new File([bytes], `import-${Date.now()}-${i + 1}.jpg`, { type: 'image/jpeg' }));
    const res = await fetch('/api/listings/upload-image', { method: 'POST', body, signal: AbortSignal.timeout(60_000) });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.url ? data.url : null;
  } catch {
    return null;
  }
}

type PriceRange = { low: number; typical: number; high: number };

interface Created {
  id: string;
  /** The read it came from, to look up its price check (which may finish after saving). */
  key: string;
  saddle: string;
  sellerName: string;
  sourceUrl: string;
  claimUrl: string;
  tips: ClaimTips;
}

export default function AdminQuickAdd({
  brands,
  siteUrl,
  fromFounder = false
}: {
  brands: { id: number; name: string }[];
  siteUrl: string;
  /** Admins write the seller message in the founder's voice. */
  fromFounder?: boolean;
}) {
  const [text, setText] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [parsed, setParsed] = useState<
    | (ParsedListing & {
        key: string;
        reader: 'ai' | 'rules';
        photoFindings?: string[];
        modelCandidates?: string[];
        spellingFixes?: string[];
        images: string[];
        photoNote: string | null;
      })
    | null
  >(null);
  const [step, setStep] = useState<string | null>(null);
  const [pickedModel, setPickedModel] = useState<string | null>(null);
  // Price checks for the seller message, by read key: a range, null if it failed, or 'loading'.
  const [ranges, setRanges] = useState<Record<string, PriceRange | null | 'loading'>>({});
  const messageFor = (c: Created) => {
    const r = ranges[c.key];
    return claimMessage(c.sellerName, c.saddle, c.claimUrl, { ...c.tips, priceRange: r && r !== 'loading' ? r : null });
  };
  const [photos, setPhotos] = useState<(ReadPhoto & { preview: string })[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  async function addPhotos(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const room = MAX_READ_PHOTOS - photos.length;
    const problems: string[] = [];
    if (files.length > room) problems.push(`Up to ${MAX_READ_PHOTOS} photos - the extras were skipped.`);
    const added: (ReadPhoto & { preview: string })[] = [];
    for (const f of files.slice(0, Math.max(0, room))) {
      try {
        added.push(await toReadPhoto(f));
      } catch {
        problems.push(`Couldn't open ${f.name}. Try a JPEG or PNG.`);
      }
    }
    setPhotos((prev) => [...prev, ...added].slice(0, MAX_READ_PHOTOS));
    setPhotoError(problems.join(' ') || null);
  }
  const [created, setCreated] = useState<Created[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  // Check the post's link as soon as it's pasted, so nobody re-adds a saddle that's already on
  // SaddleUp (added by anyone, including ones the seller asked us to remove).
  type LinkCheck =
    | { state: 'idle' | 'checking' | 'invalid' | 'new' | 'error' }
    | { state: 'exists'; importedBy: string; importedAt: string; label: string; slug: string | null };
  const [linkCheck, setLinkCheck] = useState<LinkCheck>({ state: 'idle' });
  useEffect(() => {
    const url = sourceUrl.trim();
    if (!url) return setLinkCheck({ state: 'idle' });
    setLinkCheck({ state: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/imports/check?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        if (!res.ok) return setLinkCheck({ state: 'error' });
        if (!json.valid) return setLinkCheck({ state: 'invalid' });
        setLinkCheck(json.existing ? { state: 'exists', ...json.existing } : { state: 'new' });
      } catch {
        setLinkCheck({ state: 'error' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [sourceUrl]);
  const alreadyAdded = linkCheck.state === 'exists';
  // Facebook share links (facebook.com/share/...) are different for every person who shares.
  const isShareLink = /facebook\.com\/share\//i.test(sourceUrl);

  // After the post is read: recent imports that look like the same saddle (catches share links).
  type Similar = { importedBy: string; importedAt: string; sellerName: string | null; model: string; price: number | null; label: string; slug: string | null };
  const [similar, setSimilar] = useState<Similar[]>([]);

  async function fill(e: React.FormEvent) {
    e.preventDefault();
    if (alreadyAdded) {
      setError('This post is already on SaddleUp, so it can’t be added again.');
      return;
    }
    if (!text.trim() && !photos.length) {
      setError('Paste the post or add a photo first.');
      return;
    }
    setReading(true);
    setStep(photos.length ? 'Reading the post and photos…' : 'Reading…');
    const sent = photos.map(({ media_type, data }) => ({ media_type, data }));
    const result = await readListingText(text, brands, sent);
    if ('error' in result) {
      setReading(false);
      setError(result.error);
      return;
    }
    if (!result.found.length && !result.photoFindings?.length) {
      setReading(false);
      setError(photos.length ? "Couldn't pick out any saddle details from that text or those photos." : "Couldn't pick out any saddle details from that text.");
      return;
    }
    // Saddle and stamp photos go on the listing so the seller starts with them; screenshots don't.
    const keep = sent.filter((_, i) => (result.photoKinds?.[i] ?? 'saddle') === 'saddle' || result.photoKinds?.[i] === 'stamp');
    let images: string[] = [];
    if (keep.length) {
      setStep(`Saving ${keep.length} photo${keep.length === 1 ? '' : 's'} to the listing…`);
      images = (await Promise.all(keep.map(uploadReadPhoto))).filter((u): u is string => !!u);
    }
    const skipped = sent.length - keep.length;
    const failed = keep.length - images.length;
    const photoNote =
      [
        skipped ? `Left off ${skipped} screenshot${skipped === 1 ? '' : 's'}.` : '',
        failed ? `${failed} photo${failed === 1 ? '' : 's'} couldn't be saved - add ${failed === 1 ? 'it' : 'them'} below.` : ''
      ]
        .filter(Boolean)
        .join(' ') || null;
    setReading(false);
    setStep(null);
    setError(null);
    setPickedModel(null);
    const key = String(Date.now());
    setParsed({ ...result, images, photoNote, key });
    setSimilar([]);
    if (result.prefill.brand_id && result.prefill.seat_size) {
      fetch('/api/imports/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: result.prefill.brand_id,
          seat_size: result.prefill.seat_size,
          price: result.prefill.price,
          model: result.prefill.model,
          seller_name: sellerName
        })
      })
        .then((r) => (r.ok ? r.json() : { matches: [] }))
        .then((j) => setSimilar(Array.isArray(j.matches) ? j.matches : []))
        .catch(() => {});
    }
    // Check what similar saddles sell for, in the background, for the price tip in the seller message.
    const p = result.prefill;
    if (result.reader === 'ai' && (p.brand_id || p.model)) {
      setRanges((prev) => ({ ...prev, [key]: 'loading' }));
      fetch('/api/price-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: p.brand_id, model: p.model, discipline: p.discipline, seat_size: p.seat_size, tree_width: p.tree_width,
          condition: p.condition, year_manufactured: p.year_manufactured, panel_type: p.panel_type, description: p.description
        })
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((r) => setRanges((prev) => ({ ...prev, [key]: r && r.typical ? { low: r.low, typical: r.typical, high: r.high } : null })));
    }
  }

  function reset() {
    setText('');
    setSellerName('');
    setSourceUrl('');
    setPhotos([]);
    setPhotoError(null);
    setParsed(null);
    setSimilar([]);
  }

  const latest = created[0];

  return (
    <div className="space-y-8">
      {latest && !parsed && (
        <section className="max-w-2xl bg-saddle-paper border border-saddle-green rounded p-5 space-y-3">
          <p className="font-serif text-xl text-saddle-ink">✓ Listing created: {latest.saddle}</p>
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.14em] text-saddle-gold mb-1">Claim link</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-sm break-all">{latest.claimUrl}</code>
              <CopyButton text={latest.claimUrl} label="Copy link" />
            </div>
          </div>
          <div>
            <SellerMessageCard
              key={latest.id}
              listingId={latest.id}
              sellerName={latest.sellerName}
              suggested={messageFor(latest)}
              sourceUrl={latest.sourceUrl || null}
              claimUrl={latest.claimUrl}
              messagedAt={null}
            />
            {ranges[latest.key] === 'loading' && (
              <p className="text-xs text-saddle-muted mt-2">Checking what similar saddles sell for, to add a price tip if it would help…</p>
            )}
            <p className="text-xs text-saddle-muted mt-2">
              Every saddle you add is on <Link href="/imports" className="underline">My imports</Link>, so you can come back to it.
            </p>
          </div>
        </section>
      )}

      {!parsed ? (
        <form onSubmit={fill} className="max-w-2xl bg-saddle-sand border border-saddle-line rounded p-5 space-y-3">
          <h2 className="font-serif text-xl text-saddle-ink">{created.length ? 'Add another' : 'Paste the post'}</h2>
          <div>
            <label htmlFor="source-url" className="block text-sm font-semibold mb-1">1. Link to their post</label>
            <input
              id="source-url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Paste the Facebook link first, so we can check it isn't already on SaddleUp"
              className="w-full border border-saddle-line rounded p-2 bg-saddle-paper text-sm"
              autoFocus
            />
            {linkCheck.state === 'checking' && <p className="text-xs text-saddle-muted mt-1">Checking SaddleUp…</p>}
            {linkCheck.state === 'new' && !isShareLink && <p className="text-sm text-saddle-green mt-1">✓ Not on SaddleUp yet. Go ahead.</p>}
            {linkCheck.state === 'new' && isShareLink && (
              <p className="text-sm text-saddle-brown mt-1">
                This is a share link, which is different for everyone who shares the post, so another importer&apos;s copy won&apos;t match it.
                Please open the link and paste the address from your browser bar instead (it looks like facebook.com/groups/…/posts/… or
                facebook.com/marketplace/item/…).
              </p>
            )}
            {linkCheck.state === 'invalid' && <p className="text-sm text-saddle-brown mt-1">That doesn&apos;t look like a link. Copy it from the post&apos;s Share menu or address bar.</p>}
            {linkCheck.state === 'error' && <p className="text-sm text-saddle-brown mt-1">Couldn&apos;t check the link just now. Saving will still refuse a duplicate.</p>}
            {linkCheck.state === 'idle' && <p className="text-xs text-saddle-muted mt-1">No link (e.g. a text ad)? You can still add it below.</p>}
            {linkCheck.state === 'exists' && (
              <div className="mt-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <p className="font-semibold">Already on SaddleUp. Please don&apos;t add it again.</p>
                <p>
                  Added by {linkCheck.importedBy} on{' '}
                  {new Date(linkCheck.importedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. {linkCheck.label}.
                </p>
                {linkCheck.slug && (
                  <Link href={`/saddles/${linkCheck.slug}`} className="underline" target="_blank">
                    See the listing →
                  </Link>
                )}
              </div>
            )}
          </div>
          <p className="block text-sm font-semibold -mb-1">2. Paste the post and add photos</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={'e.g. Devoucoux Biarritz 17 1/2 seat 2A flap, med tree, black. 3.3k. Ocala, Florida'}
            className="w-full border border-saddle-line rounded p-2 bg-saddle-paper text-sm"
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => photoInput.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && photoInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length) addPhotos(e.dataTransfer.files);
            }}
            className={`rounded border-2 border-dashed px-4 py-4 text-center cursor-pointer text-sm transition-colors ${
              dragging ? 'border-saddle-green bg-saddle-green/10' : 'border-saddle-line bg-saddle-paper hover:border-saddle-brown'
            }`}
          >
            <span className="font-semibold text-saddle-ink">📷 Add photos to read (optional)</span>
            <span className="block text-saddle-muted">
              Saddle photos, the stamp under the flap, or screenshots of the post. We read them to fill in blanks, and the saddle
              photos go on the listing so the seller starts with them.
            </span>
            <input
              ref={photoInput}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          {photos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <li key={p.preview.slice(-40) + i} className="relative">
                  <img src={p.preview} alt={`Photo ${i + 1}`} className="h-20 w-20 object-cover rounded border border-saddle-line" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-saddle-ink text-saddle-cream text-xs leading-none"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {photoError && <p className="text-saddle-brown text-sm">{photoError}</p>}
          <input
            value={sellerName}
            onChange={(e) => setSellerName(e.target.value)}
            placeholder="Seller's name (for the message)"
            className="w-full border border-saddle-line rounded p-2 bg-saddle-paper text-sm"
          />
          {error && <p className="text-red-700 text-sm">{error}</p>}
          <button type="submit" disabled={reading || alreadyAdded} className="bg-saddle-green text-saddle-cream px-5 py-2 rounded-sm font-semibold disabled:opacity-60">
            {reading ? step ?? 'Reading…' : 'Fill in details'}
          </button>
        </form>
      ) : (
        <section className="space-y-3">
          <div className="max-w-2xl flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-saddle-green">
              {parsed.found.length ? `Filled in ${parsed.found.join(', ')}` : 'Read the photos'}
              {parsed.reader === 'ai' ? ' and tidied up the description' : ''}.
              {parsed.missing.length > 0 && <span className="text-saddle-brown"> Please add the {parsed.missing.join(', ')}.</span>}
            </p>
            <button type="button" onClick={() => setParsed(null)} className="text-sm underline text-saddle-brown">
              ← Back to the pasted text
            </button>
          </div>
          {similar.length > 0 && (
            <div className="max-w-2xl rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-semibold">This may already be on SaddleUp. Check before saving:</p>
              <ul className="mt-1 space-y-1">
                {similar.map((m, i) => (
                  <li key={i}>
                    {m.model}
                    {m.price ? ` · $${m.price.toLocaleString('en-US')}` : ''}
                    {m.sellerName ? ` · seller ${m.sellerName}` : ''} · added by {m.importedBy} on{' '}
                    {new Date(m.importedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {m.label}
                    {m.slug && (
                      <>
                        {' · '}
                        <Link href={`/saddles/${m.slug}`} target="_blank" className="underline">
                          see it
                        </Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parsed.photoFindings && parsed.photoFindings.length > 0 && (
            <ul className="max-w-2xl text-sm text-saddle-ink bg-saddle-paper border border-saddle-green rounded p-2 space-y-1">
              <li className="font-semibold">Read from the photos:</li>
              {parsed.photoFindings.map((f) => (
                <li key={f}>📷 {f}</li>
              ))}
            </ul>
          )}
          {parsed.modelCandidates && parsed.modelCandidates.length > 0 && (
            <div className="max-w-2xl text-sm bg-saddle-paper border border-saddle-line rounded p-2 flex flex-wrap items-center gap-2">
              <span className="font-semibold">Model guess - pick the right one:</span>
              {parsed.modelCandidates.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('model') as HTMLInputElement | null;
                    if (input) input.value = m;
                    setPickedModel(m);
                  }}
                  className={`rounded border px-2 py-1 ${
                    (pickedModel ?? parsed.prefill.model) === m ? 'border-saddle-green bg-saddle-green/10' : 'border-saddle-line bg-white hover:border-saddle-brown'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          {parsed.photoNote && <p className="max-w-2xl text-sm text-saddle-brown">{parsed.photoNote}</p>}
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
            prefillImages={parsed.images}
            importMeta={{ sourceUrl, sellerName }}
            readerNotes={{ findings: parsed.photoFindings ?? [], warnings: parsed.warnings, missing: parsed.missing }}
            onSeeded={({ id, claim_token, saddle, price, hasPhotos, notes }) => {
              const claimUrl = `${siteUrl.replace(/\/$/, '')}/claim/${claim_token}`;
              const tips: ClaimTips = { spellingFixes: parsed.spellingFixes, askingPrice: price, hasPhotos, discipline: parsed.prefill.discipline, fromFounder, listingNotes: notes };
              setCreated((prev) => [{ id, key: parsed.key, saddle, sellerName, sourceUrl, claimUrl, tips }, ...prev]);
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
                <Link href={`/imports#import-${c.id}`} className="underline text-saddle-brown">
                  See message &amp; post →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
