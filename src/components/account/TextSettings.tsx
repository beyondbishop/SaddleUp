'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  phone: string | null;
  verified: boolean;
  textsOn: boolean;
  /** Texts are on, but they agreed before message alerts were covered. */
  needsMessageConsent?: boolean;
  optedOutByReply: boolean;
  verifyAvailable: boolean;
  consentText: string;
};

const pretty = (p: string | null) => (p && /^\+1\d{10}$/.test(p) ? `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}` : p ?? '');

export default function TextSettings({ phone, verified, textsOn, needsMessageConsent, optedOutByReply, verifyAvailable, consentText }: Props) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function post(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setError(data?.error ?? 'That didn’t work. Please try again.');
      return null;
    }
    return data;
  }

  return (
    <div className="space-y-4 text-sm">
      {!phone ? (
        <p className="text-saddle-muted">Add your cell phone under Your details to get texts.</p>
      ) : !verified ? (
        !verifyAvailable ? (
          <p className="text-saddle-muted">
            Text alerts are coming soon. We have your number, {pretty(phone)}, and you&apos;ll get every message and order update by email meanwhile.
          </p>
        ) : (
          <div className="space-y-2">
            <p>To get texts, confirm <strong>{pretty(phone)}</strong> is yours. We&apos;ll text it a code.</p>
            <button type="button" disabled={busy}
              onClick={async () => {
                const r = await post('/api/account/phone', { action: 'send' });
                if (r) {
                  setCodeSent(true);
                  setNote(`We texted a code to ${pretty(r.phone)}.`);
                }
              }}
              className="border border-saddle-brown text-saddle-brown rounded px-4 py-2 font-semibold disabled:opacity-50">
              {codeSent ? 'Send a new code' : 'Text me a code'}
            </button>
            {codeSent && (
              <form
                className="flex flex-wrap gap-2 items-end"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await post('/api/account/phone', { action: 'verify', code })) router.refresh();
                }}
              >
                <label>
                  <span className="block font-semibold mb-1">Code</span>
                  <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required
                    className="border rounded p-2 w-32" />
                </label>
                <button type="submit" disabled={busy} className="bg-saddle-green text-white rounded px-4 py-2 font-semibold disabled:opacity-50">
                  Confirm
                </button>
              </form>
            )}
          </div>
        )
      ) : (
        <p>Texts go to <strong>{pretty(phone)}</strong> (confirmed).</p>
      )}

      {verified && !textsOn && (
        <div className="space-y-2">
          {optedOutByReply && <p className="text-gray-600">You turned texts off by replying STOP. You can turn them back on here.</p>}
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>{consentText} <a href="/terms#text-messages" className="underline">Terms</a> · <a href="/privacy#text-messages" className="underline">Privacy</a></span>
          </label>
          <button type="button" disabled={busy || !consent}
            onClick={async () => { if (await post('/api/account/sms', { optIn: true, consent: true })) router.refresh(); }}
            className="bg-saddle-green text-white rounded px-4 py-2 font-semibold disabled:opacity-50">
            Turn on text updates
          </button>
        </div>
      )}

      {verified && textsOn && (
        <div className="space-y-2">
          <p className="text-saddle-green font-semibold">Text updates are on{needsMessageConsent ? ' for your orders' : ''}.</p>
          {needsMessageConsent && (
            <div className="space-y-2 border border-saddle-tan rounded p-3">
              <p>New: get a text the moment someone messages you about a saddle.</p>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                <span>{consentText} <a href="/terms#text-messages" className="underline">Terms</a> · <a href="/privacy#text-messages" className="underline">Privacy</a></span>
              </label>
              <button type="button" disabled={busy || !consent}
                onClick={async () => { if (await post('/api/account/sms', { optIn: true, consent: true })) router.refresh(); }}
                className="bg-saddle-green text-white rounded px-4 py-2 font-semibold disabled:opacity-50">
                Text me about messages too
              </button>
            </div>
          )}
          <button type="button" disabled={busy}
            onClick={async () => { if (await post('/api/account/sms', { optIn: false })) router.refresh(); }}
            className="underline text-gray-700">
            Turn off text updates
          </button>
        </div>
      )}

      {note && <p role="status" className="text-saddle-green">{note}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>
  );
}
