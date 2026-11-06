'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ISSUE_REASONS } from '@/lib/order-rules';

type Mode = null | 'return_request' | 'problem';

/**
 * Keep / Request a return / Report a problem. The server decides what's allowed; these props
 * only decide which buttons to show.
 */
export default function BuyerActions({
  orderId,
  canKeep,
  canReturn,
  canReport,
  inspectionEnds
}: {
  orderId: string;
  canKeep: boolean;
  canReturn: boolean;
  canReport: boolean;
  inspectionEnds: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [confirmKeep, setConfirmKeep] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'That didn’t go through. Please try again.');
    setMode(null);
    setConfirmKeep(false);
    router.refresh();
  }

  if (!canKeep && !canReturn && !canReport) return null;

  return (
    <section className="bg-saddle-cream border border-saddle-tan rounded-lg p-5 space-y-3">
      <h2 className="font-semibold">Your decision</h2>
      {inspectionEnds && (
        <p className="text-sm">
          Check the saddle fits and matches the listing. If you do nothing, the seller is paid when inspection ends on{' '}
          <strong>{inspectionEnds}</strong>.
        </p>
      )}

      {mode === null && !confirmKeep && (
        <div className="flex flex-wrap gap-2">
          {canKeep && (
            <button type="button" onClick={() => setConfirmKeep(true)} className="bg-saddle-green text-white rounded px-4 py-2 font-semibold text-sm">
              Keep this saddle
            </button>
          )}
          {canReturn && (
            <button type="button" onClick={() => setMode('return_request')} className="border border-saddle-brown text-saddle-brown rounded px-4 py-2 text-sm">
              Request a return
            </button>
          )}
          {canReport && (
            <button type="button" onClick={() => setMode('problem')} className="border border-saddle-tan rounded px-4 py-2 text-sm">
              Report a problem
            </button>
          )}
        </div>
      )}

      {confirmKeep && (
        <div className="space-y-2">
          <p className="text-sm">
            Keeping the saddle pays the seller now. After that you can&apos;t request a return through SaddleUp.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => send({ action: 'keep' })}
              className="bg-saddle-green text-white rounded px-4 py-2 font-semibold text-sm disabled:opacity-50">
              {busy ? 'Saving…' : 'Yes, keep it and pay the seller'}
            </button>
            <button type="button" onClick={() => setConfirmKeep(false)} className="text-sm underline">Not yet</button>
          </div>
        </div>
      )}

      {mode && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send({ action: mode, reason, details });
          }}
          className="space-y-3"
        >
          <fieldset>
            <legend className="text-sm font-semibold mb-1">
              {mode === 'return_request' ? 'Why are you returning it?' : 'What’s wrong?'}
            </legend>
            {Object.entries(ISSUE_REASONS[mode]).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm py-0.5">
                <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} required />
                {label}
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor="issue-details" className="text-sm font-semibold">Details</label>
            <textarea id="issue-details" value={details} onChange={(e) => setDetails(e.target.value)} required maxLength={4000} rows={4}
              placeholder="What did you notice? Photos help: you can send them when we contact you."
              className="w-full border rounded p-2 text-sm mt-1" />
          </div>
          <p className="text-xs text-gray-600">
            This pauses the seller&apos;s payout while SaddleUp reviews it. Return shipping costs depend on the reason; we&apos;ll
            explain before anything is charged.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !reason || !details.trim()}
              className="bg-saddle-brown text-white rounded px-4 py-2 font-semibold text-sm disabled:opacity-50">
              {busy ? 'Sending…' : mode === 'return_request' ? 'Request return' : 'Report problem'}
            </button>
            <button type="button" onClick={() => setMode(null)} className="text-sm underline">Cancel</button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
