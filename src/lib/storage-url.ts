// Checks that a URL points at SaddleUp's own listing storage (the public saddle-images bucket).
// Compared by host and path rather than by exact text, so a trailing slash or stray whitespace in
// NEXT_PUBLIC_SUPABASE_URL doesn't make good links fail.

const PATH = '/storage/v1/object/public/saddle-images/';

function storageHost(): string {
  try {
    return new URL((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()).host;
  } catch {
    return '';
  }
}

export function isOurStorageUrl(u: unknown): u is string {
  if (typeof u !== 'string' || u.length > 1000) return false;
  const host = storageHost();
  if (!host) return false;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && url.host === host && url.pathname.startsWith(PATH) && !url.pathname.includes('..');
  } catch {
    return false;
  }
}
