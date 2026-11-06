'use client';

/** Adds https:// to links pasted without it, so they don't open as a page on SaddleUp. */
export function postHref(url: string) {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, '')}`;
}

/** Opens the post in a window beside SaddleUp. Returns false if pop-ups are blocked. */
export function openPostWindow(href: string): boolean {
  const width = Math.min(900, Math.round(window.screen.availWidth * 0.55));
  const height = Math.round(window.screen.availHeight * 0.9);
  const left = Math.max(0, window.screen.availWidth - width);
  const win = window.open(href, 'saddleup-seller-post', `popup=yes,width=${width},height=${height},left=${left},top=0`);
  if (!win) return false;
  win.focus();
  return true;
}

/**
 * Opens the seller's post in its own window beside SaddleUp, so the importer can paste the
 * message into Messenger while still seeing it. Falls back to a new tab if pop-ups are blocked.
 */
export default function OpenPostLink({ url, label = 'Open their post', className }: { url: string; label?: string; className?: string }) {
  const href = postHref(url);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (openPostWindow(href)) e.preventDefault();
      }}
      className={className ?? 'text-sm underline text-saddle-brown'}
    >
      {label} ↗
    </a>
  );
}
