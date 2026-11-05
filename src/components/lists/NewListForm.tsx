'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewListForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) return setError(data?.error ?? 'Could not create the list.');
    router.push(`/lists/${data.list.id}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <label htmlFor="list-name" className="sr-only">New list name</label>
      <input id="list-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
        placeholder="New list, e.g. Whit’s hunting saddle" className="flex-1 min-w-0 border rounded p-2" />
      <button type="submit" disabled={saving || !name.trim()}
        className="bg-saddle-green text-white rounded px-4 font-semibold disabled:opacity-50">
        {saving ? 'Creating…' : 'Create list'}
      </button>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </form>
  );
}
