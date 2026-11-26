'use client';
import { useState } from 'react';

/** Admins: switch between seeing the site as an admin and as a regular member. */
export default function ViewAsSwitch({ to, className, children }: { to: 'member' | 'admin'; className?: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const res = await fetch('/api/account/view-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view: to })
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return alert('Could not switch views. Please try again.');
    }
    // Reload so every part of the page (and the menu) is rebuilt for the new view.
    window.location.reload();
  }
  return (
    <button type="button" onClick={go} disabled={busy} className={className}>
      {busy ? 'Switching…' : children}
    </button>
  );
}
