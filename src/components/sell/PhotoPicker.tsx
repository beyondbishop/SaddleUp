'use client';

import { useRef, useState } from 'react';
import { MAX_READ_PHOTOS, readPickedFiles, type PickedPhoto } from '@/lib/listing-photos';

/** Drop box + thumbnails for the saddle photos the AI reader will look at. */
export default function PhotoPicker({
  photos,
  setPhotos,
  compact = false
}: {
  photos: PickedPhoto[];
  setPhotos: (update: (prev: PickedPhoto[]) => PickedPhoto[]) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function add(list: FileList | File[]) {
    setBusy(true);
    const { photos: added, problems } = await readPickedFiles(list, MAX_READ_PHOTOS - photos.length);
    setPhotos((prev) => [...prev, ...added].slice(0, MAX_READ_PHOTOS));
    setProblem(problems.join(' ') || null);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) add(e.dataTransfer.files);
        }}
        className={`rounded border-2 border-dashed px-4 ${compact ? 'py-5' : 'py-8'} text-center cursor-pointer transition-colors ${
          dragging ? 'border-saddle-green bg-saddle-green/10' : 'border-saddle-line bg-saddle-paper hover:border-saddle-brown'
        }`}
      >
        <span className="block text-3xl mb-1" aria-hidden>
          📷
        </span>
        <span className="block font-semibold text-saddle-ink">
          {busy ? 'Adding photos…' : photos.length ? 'Add more photos' : 'Add 4–5 photos of your saddle'}
        </span>
        <span className="block text-sm text-saddle-muted mt-1">
          Drag them here or tap to choose. Include a close-up of the <strong>stamp under the flap</strong>: it tells us
          the seat size, tree and more.
        </span>
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <li key={p.preview.slice(-40) + i} className="relative">
              {/* Local previews (data URLs), so a plain img. */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className="h-20 w-20 object-cover rounded border border-saddle-line" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-saddle-ink text-saddle-cream text-xs leading-none"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="text-sm text-saddle-brown">{problem}</p>}
    </div>
  );
}
