'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RestoreListButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function restore() {
    setError(null);
    const res = await fetch(`/api/lists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setError(data?.error ?? 'Could not restore.');
    router.refresh();
  }
  return (
    <span className="text-right">
      <button type="button" onClick={restore} className="text-sm underline">Restore</button>
      {error && <span role="alert" className="block text-xs text-red-700">{error}</span>}
    </span>
  );
}
