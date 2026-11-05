'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { takeSavedScroll } from '@/lib/return-to';

/** Puts the visitor back where they were on this page after a sign-in round trip. */
export default function ScrollRestorer() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    const y = takeSavedScroll();
    if (y === null) return;
    // Wait a frame so images/cards have laid out.
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }));
  }, [pathname, search]);
  return null;
}
