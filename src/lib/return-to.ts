'use client';
// Send a signed-out visitor to sign in and bring them back to exactly where they were:
// same page, same filters (they're in the URL), same scroll position.

const SCROLL_KEY = (url: string) => `saddleup:scroll:${url}`;

export function currentUrl() {
  return window.location.pathname + window.location.search;
}

export function rememberScroll(url = currentUrl()) {
  try {
    sessionStorage.setItem(SCROLL_KEY(url), String(window.scrollY));
  } catch {
    // Private mode or storage blocked: they just land at the top.
  }
}

/** Saved scroll position for this URL, removed once read. */
export function takeSavedScroll(url = currentUrl()): number | null {
  try {
    const v = sessionStorage.getItem(SCROLL_KEY(url));
    if (v === null) return null;
    sessionStorage.removeItem(SCROLL_KEY(url));
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function signInHref(next = currentUrl()) {
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

/** Remember the scroll position, then go to sign-in with a return link to this page. */
export function goToSignIn(next = currentUrl()) {
  rememberScroll(next);
  window.location.href = signInHref(next);
}
