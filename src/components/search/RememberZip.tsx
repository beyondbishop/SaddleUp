'use client';
import { useEffect } from 'react';

/** Remembers the ZIP a shopper typed in the filters, so distances stay right on later visits. */
export default function RememberZip({ zip }: { zip: string }) {
  useEffect(() => {
    document.cookie = `su_zip=${zip}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [zip]);
  return null;
}
