/** Only allow redirects back to a path on this site (blocks "//evil.com" and full URLs). */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback;
}
