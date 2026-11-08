'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';

const SIDE = 512;

/** Crops a photo to a centered square and shrinks it to 512px JPEG in the browser. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const s = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(SIDE, s);
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85));
}

export default function HeadshotUploader({ initialUrl, uploaded, initials }: { initialUrl: string | null; uploaded: boolean; initials: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [own, setOwn] = useState(uploaded);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const blob = await toSquareJpeg(file);
      const form = new FormData();
      form.append('file', new File([blob], 'headshot.jpg', { type: 'image/jpeg' }));
      const res = await fetch('/api/account/avatar', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not save your photo.');
      setUrl(data.url);
      setOwn(true);
      setNote({ ok: true, text: 'Saved. Your photo now shows on your listings.' });
      router.refresh();
    } catch (e: any) {
      setNote({ ok: false, text: e?.message === 'encode' || !e?.message ? 'Couldn’t open that photo. Try a JPEG or PNG.' : e.message });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy(true);
    setNote(null);
    const res = await fetch('/api/account/avatar', { method: 'DELETE' }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setNote({ ok: false, text: 'Could not remove your photo.' });
    setOwn(false);
    setNote({ ok: true, text: 'Removed.' });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-6">
      <Avatar url={url} initials={initials} size={112} className="border border-saddle-line" />
      <div className="space-y-2">
        <input ref={input} id="headshot" type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        <label htmlFor="headshot"
          className={`inline-block bg-saddle-green text-white rounded-md px-4 py-2 text-sm font-semibold cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
          {busy ? 'Saving…' : url ? 'Change photo' : 'Add a photo'}
        </label>
        {own && (
          <button type="button" onClick={remove} disabled={busy} className="block text-sm underline text-saddle-muted">
            Remove my photo
          </button>
        )}
        {!own && url && <p className="text-xs text-saddle-muted">This is your Google photo. Upload one to use a different picture.</p>}
        {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? 'text-saddle-green' : 'text-red-700'}`}>{note.text}</p>}
      </div>
    </div>
  );
}
