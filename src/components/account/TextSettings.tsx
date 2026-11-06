'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  phone: string | null;
  verified: boolean;
  textsOn: boolean;
  optedOutByReply: boolean;
  verifyAvailable: boolean;
  consentText: string;
};

const pretty = (p: string | null) => (p && /^\+1\d{10}$/.test(p) ? `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}` : p ?? '');

export default function TextSettings({ phone, verified, textsOn, optedOutByReply, verifyAvailable, consentText }: Props) {
  const router = useRouter();
  const [number, setNumber] = useState(pretty(phone));
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

  if (!verifyAvailable) {
    return <p className="text-sm text-gray-600">Text updates are coming soon. You&apos;ll get every order update by email meanwhile.</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      {!verified ? (
        <div className="space-y-2">
          <form
            className="flex flex-wrap gap-2 items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await post('/api/account/phone', { action: 'send', phone: number });
              if (r) {
                setCodeSent(true);
                setNote(`We texted a code to ${pretty(r.phone)}.`);
              }
            }}
          >
            <label className="flex-1 min-w-[12rem]">
              <span className="block font-semibold mb-1">Mobile number (US)</span>
              <input type="tel" autoComplete="tel" value={number} onChange={(e) => setNumber(e.target.value)} required
                className="w-full border rounded p-2" placeholder="(415) 555-0123" />
            </label>
            <button type="submit" disabled={busy} className="border border-saddle-brown text-saddle-brown rounded px-4 py-2 font-semibold disabled:opacity-50">
              {codeSent ? 'Send a new code' : 'Text me a code'}
            </button>
          </form>
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
                Verify
              </button>
            </form>
          )}
        </div>
      ) : (
        <p>
          Verified number: <strong>{pretty(phone)}</strong>{' '}
          <button type="button" className="underline text-gray-600" onClick={() => router.push('?change=1')}>Change</button>
        </p>
      )}

      {verified && !textsOn && (
        <div className="space-y-2">
          {optedOutByReply && <p className="text-gray-600">You turned texts off by replying STOP. You can turn them back on here.</p>}
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>{consentText}</span>
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
          <p className="text-saddle-green font-semibold">Text updates are on.</p>
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
