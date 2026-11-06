// Client helpers for reading saddle photos with the AI reader: shrink a photo for reading, save a
// read photo to listing storage, and hold photos picked on the home page across sign-in.

export type ReadPhoto = { media_type: 'image/jpeg'; data: string };
export type PickedPhoto = ReadPhoto & { preview: string };

export const MAX_READ_PHOTOS = 6;
const READ_SIDE = 1568; // Claude reads images at up to about this size, enough for a stamp close-up

/** Shrinks a photo in the browser to a JPEG data URL for the reader. */
export async function toReadPhoto(file: File): Promise<PickedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, READ_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let url = '';
  for (const quality of [0.85, 0.7, 0.55]) {
    url = canvas.toDataURL('image/jpeg', quality);
    if (url.length < 700_000) break;
  }
  return { media_type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1), preview: url };
}

/** Picks the image files out of a drop or file choice and shrinks them, up to `room` photos. */
export async function readPickedFiles(list: FileList | File[], room: number): Promise<{ photos: PickedPhoto[]; problems: string[] }> {
  const files = Array.from(list).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  const problems: string[] = [];
  if (files.length > room) problems.push(`Up to ${MAX_READ_PHOTOS} photos - the extras were skipped.`);
  const photos: PickedPhoto[] = [];
  for (const f of files.slice(0, Math.max(0, room))) {
    try {
      photos.push(await toReadPhoto(f));
    } catch {
      problems.push(`Couldn't open ${f.name}. Try a JPEG or PNG.`);
    }
  }
  return { photos, problems };
}

/** Saves a read photo to listing storage so it can go on the listing. Null if it fails. */
export async function uploadReadPhoto(photo: ReadPhoto, i: number): Promise<string | null> {
  try {
    const bytes = Uint8Array.from(atob(photo.data), (c) => c.charCodeAt(0));
    const body = new FormData();
    body.append('file', new File([bytes], `saddle-${Date.now()}-${i + 1}.jpg`, { type: 'image/jpeg' }));
    const res = await fetch('/api/listings/upload-image', { method: 'POST', body, signal: AbortSignal.timeout(60_000) });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.url ? data.url : null;
  } catch {
    return null;
  }
}

// ---- A check done on the home page, kept in this browser until the listing page reads it ----
// IndexedDB rather than sessionStorage: 5 photos can be a few MB, and they must survive sign-in.

const DB = 'saddleup-sell';
const STORE = 'pending';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * A saddle check done before signing in: the photos plus, once read, what the AI found and the
 * price range. Kept so the listing form can be filled after sign-up without reading again.
 */
export interface PendingCheck {
  photos: PickedPhoto[];
  result?: unknown;
  price?: { low: number; typical: number; high: number; reasoning: string } | null;
}

export async function savePendingCheck(check: PendingCheck): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...check, at: Date.now() }, 'check');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

/** Reads and clears the pending check (ignores one older than a day). */
export async function takePendingCheck(): Promise<PendingCheck | null> {
  try {
    const db = await openDb();
    const value = await new Promise<(PendingCheck & { at: number }) | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const get = store.get('check');
      get.onsuccess = () => {
        store.delete('check');
        resolve(get.result);
      };
      tx.onerror = () => reject(tx.error);
    });
    if (!value || Date.now() - value.at > 86_400_000 || !value.photos?.length) return null;
    return value;
  } catch {
    return null;
  }
}
