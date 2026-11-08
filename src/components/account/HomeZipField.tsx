'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** The member's home ZIP, used to show how far saddles are from them. Kept on their sign-in record. */
export default function HomeZipField({ initialZip, place }: { initialZip: string; place: string | null }) {
  const router = useRouter();
  const [zip, setZip] = useState(initialZip);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = zip.trim();
    if (clean && !/^\d{5}$/.test(clean)) return setNote({ ok: false, text: 'Please enter a 5-digit ZIP code.' });
    setBusy(true);
    setNote(null);
    const { error } = await createClient().auth.updateUser({ data: { home_zip: clean || null } });
    // A ZIP typed in the browse filters would otherwise win; this one is the newest choice.
    document.cookie = 'su_zip=; path=/; max-age=0';
    setBusy(false);
    if (error) return setNote({ ok: false, text: 'Could not save. Please try again.' });
    setNote({ ok: true, text: clean ? 'Saved. Distances on saddles are now measured from here.' : 'Removed.' });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="home-zip" className="block font-semibold">Your ZIP code</label>
      <p className="text-sm text-saddle-muted">So we can show how far each saddle is from you. Only used for distances; it’s never shown to anyone.</p>
      <div className="flex gap-2">
        <input id="home-zip" inputMode="numeric" maxLength={5} placeholder="e.g. 27514" value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} className="border border-saddle-line rounded p-2 w-32 bg-white" />
        <button type="submit" disabled={busy} className="bg-saddle-green text-white rounded-md px-4 text-sm font-semibold disabled:opacity-60">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {place && !note && <p className="text-sm text-saddle-muted">{place}</p>}
      {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? 'text-saddle-green' : 'text-red-700'}`}>{note.text}</p>}
    </form>
  );
}
