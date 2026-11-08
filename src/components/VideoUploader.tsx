'use client';

import { useRef, useState } from 'react';

const MAX_MB = 50;

/** Uploads straight to storage with a signed URL, reporting progress. Resolves to the public URL. */
function uploadVideo(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const res = await fetch('/api/listings/video-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, type: file.type, size: file.size })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok || !data?.uploadUrl) return reject(new Error(data?.error ?? 'Couldn’t start the upload.'));

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(data.publicUrl) : reject(new Error('The upload didn’t finish. Please try again.')));
    xhr.onerror = () => reject(new Error('The upload was interrupted. Check your connection and try again.'));
    xhr.send(file);
  });
}

/** One short video for the listing: a walk-around, the flaps, the panels. */
export default function VideoUploader({ video, setVideo }: { video: string | null; setVideo: (url: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('video/')) return setError('That isn’t a video file.');
    if (file.size > MAX_MB * 1024 * 1024) {
      return setError(`That video is ${Math.round(file.size / 1024 / 1024)} MB. Videos can be up to ${MAX_MB} MB (about a minute of phone video), so try trimming it.`);
    }
    setProgress(0);
    try {
      setVideo(await uploadVideo(file, setProgress));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <span className="block text-sm font-semibold mb-1">
        Video <span className="font-normal text-saddle-muted">(optional)</span>
      </span>
      {video ? (
        <div className="space-y-2">
          <video src={video} controls playsInline preload="metadata" className="w-full max-h-80 rounded border border-saddle-line bg-black" />
          <div className="flex gap-3 text-sm">
            <button type="button" onClick={() => input.current?.click()} className="underline">Replace video</button>
            <button type="button" onClick={() => setVideo(null)} className="underline text-red-700">Remove video</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={progress !== null}
          className="w-full rounded border-2 border-dashed border-saddle-line bg-saddle-paper hover:border-saddle-brown px-4 py-5 text-center"
        >
          <span className="block font-semibold text-saddle-ink">
            {progress !== null ? `Uploading video… ${progress}%` : '🎥 Add a short video'}
          </span>
          <span className="block text-sm text-saddle-muted">
            A slow walk-around helps buyers see the shape, flaps and panels. Up to {MAX_MB} MB (about a minute).
          </span>
        </button>
      )}
      {progress !== null && video && <p className="text-sm text-saddle-muted mt-1">Uploading new video… {progress}%</p>}
      {error && <p className="text-sm text-red-700 mt-1">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/3gpp"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
