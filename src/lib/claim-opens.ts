import { createHash } from 'crypto';

/**
 * Helpers for telling a seller opening their claim link from an importer (or admin) checking it.
 *
 * - TEAM_COOKIE is set in any browser where an importer opens My imports, so a later signed-out
 *   visit from that browser is still recognised.
 * - networkHash is a one-way hash of the visitor's IP. Importers' networks are saved (hashed) in
 *   team_networks when they open My imports, so opens from the same Wi-Fi are recognised too.
 *   The raw IP is never stored.
 */
export { TEAM_COOKIE, SOON_AFTER_MINUTES } from './claim-opens-shared';

export function clientIp(h: Headers) {
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || '';
}

export function networkHash(ip: string) {
  if (!ip) return null;
  const secret = process.env.VIEW_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createHash('sha256').update(`net|${ip}|${secret}`).digest('hex');
}

/** Plain-words device and app from a user agent, e.g. { device: 'iPhone', app: 'Messenger app' }. */
export function describeUserAgent(ua: string): { device: string; app: string } {
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android phone'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows PC'
            : /CrOS/.test(ua)
              ? 'Chromebook'
              : /Linux/.test(ua)
                ? 'Linux computer'
                : 'Unknown device';
  const app = /MessengerForiOS|Orca-Android|MessengerLite/.test(ua)
    ? 'Messenger app'
    : /FBAN|FBAV|FB_IAB|FB4A/.test(ua)
      ? 'Facebook app'
      : /Instagram/.test(ua)
        ? 'Instagram app'
        : /Edg\//.test(ua)
          ? 'Edge'
          : /Firefox|FxiOS/.test(ua)
            ? 'Firefox'
            : /Chrome|CriOS/.test(ua)
              ? 'Chrome'
              : /Safari/.test(ua)
                ? 'Safari'
                : 'a browser';
  return { device, app };
}
