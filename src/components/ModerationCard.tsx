'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DISCIPLINE_LABELS, TREE_WIDTH_LABELS, TRIAL_POLICY_LABELS } from '@/lib/types';

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}

const errorText = (e: unknown) =>
  e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'That took too long — try again.';

export default function ModerationCard({ listing, sellerEmail }: { listing: any; sellerEmail?: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  async function decide(status: 'active' | 'removed') {
    setLoading(true);
    setError(null);
    try {
      await post('/api/admin/moderate', { id: listing.id, status });
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await post('/api/admin/feedback', { listingId: listing.id, message });
      setSent(true);
      setMessage('');
      setShowMessage(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  const title = `${listing.seat_size}" ${listing.brands?.name && listing.brands.name !== 'Other' ? `${listing.brands.name} ` : ''}${listing.model}`;
  const details = [
    DISCIPLINE_LABELS[listing.discipline as keyof typeof DISCIPLINE_LABELS],
    listing.tree_width ? `${TREE_WIDTH_LABELS[listing.tree_width as keyof typeof TREE_WIDTH_LABELS]} tree` : 'No tree width yet',
    listing.color,
    listing.condition,
    [listing.location_city, listing.location_state].filter(Boolean).join(', '),
    listing.trial_policy ? TRIAL_POLICY_LABELS[listing.trial_policy as keyof typeof TRIAL_POLICY_LABELS] : null
  ].filter(Boolean);

  return (
    <div className="bg-saddle-paper border border-saddle-line rounded p-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href={`/saddles/${listing.slug}`} className="shrink-0">
          {listing.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.images[0]} alt="" className="w-28 h-28 object-cover rounded" />
          ) : (
            <div className="w-28 h-28 rounded bg-stripes flex items-center justify-center text-[10px] font-mono uppercase text-saddle-brown/50">
              No photo
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/saddles/${listing.slug}`} className="font-serif text-xl text-saddle-ink hover:underline">
            {title}
          </Link>
          <p className="font-serif text-lg text-saddle-brown">${(listing.price_cents / 100).toLocaleString()}</p>
          <p className="text-sm text-saddle-muted">{details.join(' · ')}</p>
          <p className="text-sm text-saddle-muted">
            {listing.images?.length ?? 0} photo{listing.images?.length === 1 ? '' : 's'} · Seller:{' '}
            {sellerEmail ?? (listing.seller_id ? 'unknown' : 'not claimed yet')}
            {' · '}Submitted {new Date(listing.created_at).toLocaleDateString()}
          </p>
          {listing.description && (
            <p className="text-sm text-saddle-body mt-2 line-clamp-3 whitespace-pre-line">{listing.description}</p>
          )}
          {listing.ebay_item_id && (
            <p className="text-sm text-saddle-gold mt-1">
              Imported from{' '}
              <a href={listing.ebay_item_url} target="_blank" rel="noopener noreferrer" className="underline">
                eBay #{listing.ebay_item_id}
              </a>
              {listing.ebay_seller_username ? ` · eBay seller: ${listing.ebay_seller_username}` : ''} — check this matches the
              SaddleUp seller.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => decide('active')}
          disabled={loading}
          className="bg-saddle-green text-saddle-cream px-3 py-1.5 rounded-sm text-sm font-semibold disabled:opacity-60"
        >
          Approve
        </button>
        <button
          onClick={() => decide('removed')}
          disabled={loading}
          className="bg-red-700 text-white px-3 py-1.5 rounded-sm text-sm font-semibold disabled:opacity-60"
        >
          Reject
        </button>
        <Link href={`/saddles/${listing.slug}`} className="text-sm border border-saddle-brown text-saddle-brown px-3 py-1.5 rounded-sm">
          View
        </Link>
        <Link
          href={`/dashboard/listings/${listing.id}/edit`}
          className="text-sm border border-saddle-brown text-saddle-brown px-3 py-1.5 rounded-sm"
        >
          Edit
        </Link>
        {listing.seller_id && (
          <button
            onClick={() => setShowMessage((s) => !s)}
            className="text-sm border border-saddle-brown text-saddle-brown px-3 py-1.5 rounded-sm"
          >
            Message seller
          </button>
        )}
        {sent && <span className="text-sm text-saddle-green">Message sent ✓ — it&apos;s in their Messages.</span>}
      </div>

      {showMessage && (
        <form onSubmit={sendMessage} className="space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            placeholder="e.g. Great saddle! Could you add photos of the panels and the tree point, and confirm the price ($3,950 or $4,250)?"
            className="w-full border border-saddle-line rounded p-2 bg-white text-sm"
          />
          <button type="submit" disabled={loading} className="bg-saddle-brown text-saddle-cream px-4 py-1.5 rounded-sm text-sm font-semibold disabled:opacity-60">
            {loading ? 'Sending…' : 'Send to seller'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
