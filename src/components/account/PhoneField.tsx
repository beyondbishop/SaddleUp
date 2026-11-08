'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const pretty = (p: string | null) => (p && /^\+1\d{10}$/.test(p) ? `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}` : p ?? '');

/** The member's cell number, used for text alerts. Changing it means confirming the new one before texts resume. */
export default function PhoneField({ initialPhone, verified }: { initialPhone: string | null; verified: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState(pretty(initialPhone));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const res = await fetch('/api/account/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', phone })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setNote({ ok: false, text: data?.error ?? 'Could not save. Please try again.' });
    setPhone(pretty(data.phone));
    setNote({ ok: true, text: data.phone ? 'Saved. Turn on texts under Notifications below.' : 'Removed.' });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="cell-phone" className="block font-semibold">
        Cell phone {initialPhone && verified && <span className="ml-1 text-xs font-normal text-saddle-green">Confirmed</span>}
      </label>
      <p className="text-sm text-saddle-muted">For text alerts, like when a buyer messages you. US numbers only. We never share it.</p>
      <div className="flex gap-2">
        <input id="cell-phone" type="tel" autoComplete="tel" placeholder="(919) 555-0123" value={phone}
          onChange={(e) => setPhone(e.target.value)} className="border border-saddle-line rounded p-2 flex-1 min-w-0 bg-white" />
        <button type="submit" disabled={busy} className="bg-saddle-green text-white rounded-md px-4 text-sm font-semibold disabled:opacity-60">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? 'text-saddle-green' : 'text-red-700'}`}>{note.text}</p>}
    </form>
  );
}
