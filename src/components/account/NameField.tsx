'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** The member's name: shown to buyers and sellers they message, and used in our emails. */
export default function NameField({ userId, initialName }: { userId: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return setNote({ ok: false, text: 'Please enter your name.' });
    setBusy(true);
    setNote(null);
    const { error } = await createClient().from('profiles').update({ full_name: clean }).eq('id', userId);
    setBusy(false);
    if (error) return setNote({ ok: false, text: 'Could not save. Please try again.' });
    setName(clean);
    setNote({ ok: true, text: 'Saved.' });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="full-name" className="block font-semibold">Your name</label>
      <p className="text-sm text-saddle-muted">Buyers and sellers see your first name when you message them.</p>
      <div className="flex gap-2">
        <input id="full-name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
          className="border border-saddle-line rounded p-2 flex-1 min-w-0 bg-white" />
        <button type="submit" disabled={busy} className="bg-saddle-green text-white rounded-md px-4 text-sm font-semibold disabled:opacity-60">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? 'text-saddle-green' : 'text-red-700'}`}>{note.text}</p>}
    </form>
  );
}
