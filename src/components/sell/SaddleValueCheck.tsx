'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoPicker from './PhotoPicker';
import { savePendingCheck, type PickedPhoto } from '@/lib/listing-photos';
import { listingPhotoIndexes, runSaddleCheck, type SaddleCheck } from '@/lib/saddle-check';
import { TREE_WIDTH_LABELS } from '@/lib/types';
import { SELLER_FEE_PERCENT } from '@/lib/fees';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

/**
 * Home page "Curious what your saddle's worth?": a visitor (no account needed) adds photos, the
 * AI reads them and checks prices, and they see the value plus a preview of their listing. One
 * click then takes them to sign up, and the check is carried into the listing form.
 */
export default function SaddleValueCheck({ brands }: { brands: { id: number; name: string }[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<SaddleCheck | null>(null);
  const [going, setGoing] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await runSaddleCheck(photos, '', brands, setStep);
    setLoading(false);
    setStep(null);
    if ('error' in res) return setError(res.error);
    setCheck(res);
  }

  async function listIt() {
    if (!check) return;
    setGoing(true);
    await savePendingCheck({ photos, result: check.result, price: check.price });
    router.push('/dashboard/listings/new?from=home');
  }

  if (check) {
    const p = check.result.prefill;
    const brand = brands.find((b) => b.id === p.brand_id)?.name;
    const title = [p.seat_size ? `${p.seat_size}"` : null, brand && brand !== 'Other' ? brand : null, p.model].filter(Boolean).join(' ') || 'Your saddle';
    const cover = photos[listingPhotoIndexes(check.result, photos.length)[0] ?? 0];
    const price = p.price ?? check.price?.typical ?? null;

    return (
      <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          {check.price ? (
            <div className="rounded border border-saddle-green bg-saddle-paper p-5">
              <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold mb-1">Your saddle is worth about</div>
              <div className="font-serif text-[34px] leading-tight text-saddle-ink">
                {usd(check.price.low)}–{usd(check.price.high)}
              </div>
              <p className="text-sm text-saddle-body mt-2">{check.price.reasoning}</p>
              <p className="text-xs text-saddle-muted mt-2">
                An estimate from similar saddles listed right now. A fair asking price is around {usd(check.price.typical)}.
              </p>
            </div>
          ) : (
            <p className="text-sm text-saddle-muted">We couldn&apos;t check prices just now, but here&apos;s your listing.</p>
          )}
          {check.result.photoFindings && check.result.photoFindings.length > 0 && (
            <ul className="text-sm text-saddle-ink space-y-1">
              <li className="font-semibold">What we read from your photos:</li>
              {check.result.photoFindings.slice(0, 5).map((f) => (
                <li key={f}>📷 {f}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={listIt}
              disabled={going}
              className="bg-saddle-green text-saddle-cream px-6 py-3.5 rounded-sm font-semibold text-[15px] hover:bg-saddle-green-dark disabled:opacity-60"
            >
              {going ? 'One moment…' : 'List it free →'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCheck(null);
                setPhotos([]);
              }}
              className="text-sm underline text-saddle-brown"
            >
              Check another saddle
            </button>
          </div>
          <p className="text-xs text-saddle-muted">
            Create a free account in a few seconds and your photos and details come with you. Free to list, just {SELLER_FEE_PERCENT}% if it
            sells.
          </p>
        </div>

        <div>
          <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold mb-2">Your listing preview</div>
          <div className="bg-saddle-paper border border-saddle-line rounded-[3px] overflow-hidden">
            {cover && (
              // Local preview (data URL), so a plain img.
              <img src={cover.preview} alt={title} className="w-full aspect-[4/3] object-cover" />
            )}
            <div className="p-5">
              <div className="font-serif text-2xl leading-tight text-saddle-ink">{title}</div>
              <div className="text-sm text-saddle-muted mt-1">
                {[p.tree_width ? `${TREE_WIDTH_LABELS[p.tree_width]} tree` : null, p.condition ? `${p.condition[0].toUpperCase()}${p.condition.slice(1)} condition` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {price ? <div className="font-serif text-[26px] text-saddle-brown mt-3">{usd(price)}</div> : null}
              {p.description && (
                <p className="text-sm text-saddle-body mt-3 whitespace-pre-line line-clamp-[10]">{p.description}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-saddle-muted mt-2">You can change anything before it goes live.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[640px] space-y-4">
      <PhotoPicker photos={photos} setPhotos={setPhotos} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={loading || !photos.length}
          className="bg-saddle-green text-saddle-cream px-6 py-3.5 rounded-sm font-semibold text-[15px] hover:bg-saddle-green-dark disabled:opacity-60"
        >
          {loading ? step ?? 'Reading…' : "See what it's worth →"}
        </button>
        <span className="text-sm text-saddle-muted">{loading ? 'This takes about 30 seconds.' : 'Free, no account needed.'}</span>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
