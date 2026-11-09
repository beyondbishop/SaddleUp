/** The site's public address, without a trailing slash. Falls back to saddleup.me if unset. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://saddleup.me').trim().replace(/\/$/, '');
