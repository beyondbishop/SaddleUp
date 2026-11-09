'use client';

import { useState } from 'react';

/** "Send me a test": emails this message to the signed-in admin and shows what Resend said. */
export default function SendTestEmail({ kind }: { kind: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    const res = await fetch('/api/admin/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind })
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (json.status === 'sent') return setResult({ ok: true, text: `Sent to ${json.to}. Check your inbox.` });
    const setup = json.setup
      ? ` (Resend key on the live site: ${json.setup.resendKey ? 'yes' : 'NO'}; EMAIL_FROM: ${json.setup.emailFrom ?? 'NOT SET'}; sends from: ${json.setup.sendsFrom})`
      : '';
    setResult({ ok: false, text: `Not sent: ${json.status ?? 'error'} ${json.detail ?? json.error ?? ''}${setup}` });
  }

  return (
    <div className="px-4 py-2 border-t border-saddle-line text-sm flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="rounded bg-saddle-green px-3 py-1.5 font-semibold text-white disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send me a test'}
      </button>
      {result && <span className={result.ok ? 'text-saddle-green' : 'text-red-800 break-all'}>{result.text}</span>}
    </div>
  );
}
