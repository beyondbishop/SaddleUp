'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CHOICE_LABELS, allowedChoices, currentChoice, type StatusChoice } from '@/lib/listing-status';

type Props = {
  listing: { id: string; status: string; seller_id: string | null; show_before_claim?: boolean | null };
  /** Compact for table rows. */
  compact?: boolean;
};

/** Admin: change a listing's status (put it back live, draft, remove, show/hide an unclaimed import). */
export default function ListingStatusPicker({ listing, compact }: Props) {
  const router = useRouter();
  const current = currentChoice(listing);
  const choices = allowedChoices(listing);
  const [value, setValue] = useState<StatusChoice | null>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!current || !choices.length) {
    return compact ? null : <p className="text-sm text-saddle-muted">This saddle has a sale, so its status follows the order.</p>;
  }

  async function change(next: StatusChoice) {
    const prev = value;
    setValue(next);
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/listings/${listing.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice: next })
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setValue(prev);
      setError(json.error ?? 'Could not change the status.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={compact ? 'inline-flex flex-col items-start gap-0.5' : 'flex flex-wrap items-center gap-2'}>
      {!compact && <label htmlFor={`status-${listing.id}`} className="text-sm font-semibold">Status</label>}
      <select
        id={`status-${listing.id}`}
        value={value ?? ''}
        disabled={busy}
        onChange={(e) => change(e.target.value as StatusChoice)}
        aria-label="Listing status"
        className={`border border-saddle-line rounded bg-white ${compact ? 'text-xs py-0.5 px-1 max-w-[11rem]' : 'text-sm p-1.5'}`}
      >
        {choices.map((c) => (
          <option key={c} value={c}>{CHOICE_LABELS[c]}</option>
        ))}
      </select>
      {busy && <span className="text-xs text-saddle-muted">Saving…</span>}
      {saved && !busy && <span className="text-xs text-saddle-green-dark">Saved</span>}
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
