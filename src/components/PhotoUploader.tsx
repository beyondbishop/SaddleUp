'use client';

import { useRef, useState } from 'react';

const MAX_SIDE = 2000; // px — plenty for a listing photo, and keeps uploads small
const MAX_BYTES = 4 * 1024 * 1024; // the upload route's limit
const MAX_PHOTOS = 20;

/** Shrinks big photos (phone pictures are often 5–12 MB) to a JPEG under the upload limit. */
async function shrink(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= MAX_BYTES && file.type !== 'image/heic') {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.85, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
      }
    }
  } catch {
    // The browser couldn't read it (e.g. HEIC outside Safari) — try the original.
  }
  return file;
}

async function upload(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/listings/upload-image', { method: 'POST', body, signal: AbortSignal.timeout(60_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error ?? `Couldn't upload ${file.name}.`);
  return data.url;
}

/**
 * Photo area for the listing form: drag photos in (or click to choose), see progress, remove
 * photos, and pick which one is the cover (the first photo is what buyers see in search).
 */
export default function PhotoUploader({
  images,
  setImages
}: {
  images: string[];
  setImages: (update: (prev: string[]) => string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const skipped = Array.from(list).length - files.length;
    const room = MAX_PHOTOS - images.length;
    const batch = files.slice(0, Math.max(0, room));
    const problems: string[] = [];
    if (skipped) problems.push(`${skipped} file${skipped === 1 ? " wasn't a photo" : "s weren't photos"} and ${skipped === 1 ? 'was' : 'were'} skipped.`);
    if (files.length > batch.length) problems.push(`Only ${MAX_PHOTOS} photos per listing — the extras were skipped.`);
    if (!batch.length) return setErrors(problems);

    setErrors([]);
    setProgress({ done: 0, total: batch.length });
    for (const [i, file] of batch.entries()) {
      try {
        const url = await upload(await shrink(file));
        setImages((prev) => [...prev, url]);
      } catch (e) {
        problems.push(e instanceof Error && e.name !== 'TimeoutError' ? e.message : `${file.name} took too long to upload.`);
      }
      setProgress({ done: i + 1, total: batch.length });
    }
    setProgress(null);
    setErrors(problems);
  }

  const move = (from: number, to: number) =>
    setImages((prev) => {
      const next = [...prev];
      const [img] = next.splice(from, 1);
      next.splice(to, 0, img);
      return next;
    });

  return (
    <div>
      <span className="block text-sm font-semibold mb-1">Photos</span>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center text-center gap-1 rounded border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${
          dragging ? 'border-saddle-green bg-saddle-green/10' : 'border-saddle-line bg-saddle-paper hover:border-saddle-brown'
        }`}
      >
        <span className="text-3xl" aria-hidden>
          📷
        </span>
        <span className="font-semibold text-saddle-ink">
          {progress ? `Uploading ${progress.done + 1 > progress.total ? progress.total : progress.done + 1} of ${progress.total}…` : 'Drag photos here'}
        </span>
        <span className="text-sm text-saddle-muted">
          or <span className="underline">click to choose</span> · up to {MAX_PHOTOS} photos · big photos are resized automatically
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 space-y-1">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <>
          <p className="text-xs text-saddle-muted mt-3 mb-1">The first photo is the cover buyers see in search.</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {images.map((img, i) => (
              <div key={img} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`Photo ${i + 1}`} className="w-full aspect-square object-cover rounded border border-saddle-line" />
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 bg-saddle-green text-saddle-cream text-[10px] font-semibold px-1.5 py-0.5 rounded-sm">
                    Cover
                  </span>
                )}
                <div className="absolute top-1 right-1 flex gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => move(i, 0)}
                      title="Make this the cover photo"
                      className="bg-saddle-paper/90 text-saddle-brown text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border border-saddle-line"
                    >
                      Make cover
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((x) => x !== img))}
                    aria-label={`Remove photo ${i + 1}`}
                    className="w-6 h-6 rounded-full bg-saddle-ink text-saddle-cream text-xs leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
