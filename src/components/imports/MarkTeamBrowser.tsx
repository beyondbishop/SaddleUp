'use client';

import { useEffect } from 'react';
import { TEAM_COOKIE } from '@/lib/claim-opens-shared';

/**
 * Remembers this browser as an importer's, for a year, so if they open a seller's claim link
 * here while signed out it isn't counted as the seller opening it.
 */
export default function MarkTeamBrowser() {
  useEffect(() => {
    document.cookie = `${TEAM_COOKIE}=1; max-age=31536000; path=/; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
  }, []);
  return null;
}
