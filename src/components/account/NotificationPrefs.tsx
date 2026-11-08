'use client';
import { useState } from 'react';
import type { PrefKey, Prefs } from '@/lib/notification-prefs';

type Row = { title: string; body: string; email: PrefKey | 'always' | null; sms: PrefKey | null };

const ROWS: Row[] = [
  { title: 'Messages', body: 'When a buyer or seller messages you about a saddle.', email: 'messages_email', sms: 'messages_sms' },
  { title: 'Orders', body: 'Payment, shipping, delivery, inspection deadlines, returns and payouts.', email: 'always', sms: 'orders_sms' },
  { title: 'Your listings', body: 'When a saddle you list is added, and when it goes live.', email: 'listings_email', sms: null },
  { title: 'Saved search alerts', body: 'When a new saddle matches a search you saved.', email: 'matches_email', sms: null }
];

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        on ? 'bg-saddle-green' : 'bg-gray-300'
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function NotificationPrefs({
  initial,
  textsOn,
  messageTextsAllowed
}: {
  initial: Prefs;
  /** Verified phone + agreed to texts. */
  textsOn: boolean;
  /** Their text consent covers message alerts (newer wording). */
  messageTextsAllowed: boolean;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function set(key: PrefKey, on: boolean) {
    setError(null);
    setPrefs((p) => ({ ...p, [key]: on }));
    const res = await fetch('/api/account/notification-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, on })
    }).catch(() => null);
    if (!res?.ok) {
      setPrefs((p) => ({ ...p, [key]: !on }));
      setError('That didn’t save. Please try again.');
    }
  }

  const smsUsable = (key: PrefKey) => textsOn && (key !== 'messages_sms' || messageTextsAllowed);
  const messageTextsReaching = prefs.messages_sms && smsUsable('messages_sms');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_auto] text-sm">
        <span />
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-saddle-muted text-center px-2">Email</span>
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-saddle-muted text-center px-2">Text</span>
        {ROWS.map((r) => (
          <div key={r.title} className="contents">
            <div className="py-3 border-t border-saddle-line pr-3">
              <div className="font-semibold">{r.title}</div>
              <div className="text-saddle-muted">{r.body}</div>
            </div>
            <div className="py-3 px-2 border-t border-saddle-line flex justify-center items-center">
              {r.email === 'always' ? (
                <span className="text-xs text-saddle-muted text-center leading-tight w-11">Always on</span>
              ) : r.email ? (
                <Switch on={prefs[r.email]} label={`${r.title} by email`} onChange={(v) => set(r.email as PrefKey, v)} />
              ) : null}
            </div>
            <div className="py-3 px-2 border-t border-saddle-line flex justify-center items-center">
              {r.sms ? (
                <Switch
                  on={prefs[r.sms] && smsUsable(r.sms)}
                  disabled={!smsUsable(r.sms)}
                  label={`${r.title} by text`}
                  onChange={(v) => set(r.sms as PrefKey, v)}
                />
              ) : (
                <span className="text-saddle-muted w-11 text-center" aria-hidden>–</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {textsOn && !messageTextsAllowed && <p className="text-sm text-saddle-muted">To get messages by text, agree to message texts below.</p>}
      {!prefs.messages_email && !messageTextsReaching && (
        <p role="status" className="text-sm text-red-700">
          Heads up: with message emails and texts both off, you won’t hear about interested buyers unless you check Messages.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
