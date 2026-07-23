'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { DISCIPLINE_LABELS, TREE_WIDTH_LABELS } from '@/lib/types';

export default function WatchlistForm({ brands }: { brands: { id: number; name: string }[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Please sign in first.');
      setSaving(false);
      return;
    }

    const form = new FormData(e.currentTarget);
    const trees = form.getAll('tree_width') as string[];

    const { error: saveError } = await supabase.from('saved_searches').insert({
      user_id: user.id,
      label: String(form.get('label') || 'My saved search'),
      discipline: form.get('discipline') || null,
      brand_id: form.get('brand_id') ? Number(form.get('brand_id')) : null,
      seat_size_min: form.get('seat_size_min') ? Number(form.get('seat_size_min')) : null,
      seat_size_max: form.get('seat_size_max') ? Number(form.get('seat_size_max')) : null,
      tree_widths: trees.length ? trees : null,
      price_max_cents: form.get('price_max') ? Number(form.get('price_max')) * 100 : null
    });

    setSaving(false);
    if (saveError) return setError(saveError.message);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-saddle-tan rounded-lg p-4 space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <input name="label" placeholder="e.g. 17in Medium H/J under $3k" className="w-full border rounded p-2 text-sm" />

      <select name="discipline" className="w-full border rounded p-2 text-sm">
        <option value="">Any Discipline</option>
        {Object.entries(DISCIPLINE_LABELS).map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>

      <select name="brand_id" className="w-full border rounded p-2 text-sm">
        <option value="">Any Brand</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      <div className="flex gap-2">
        <input name="seat_size_min" type="number" step="0.5" placeholder="Seat min" className="w-1/2 border rounded p-2 text-sm" />
        <input name="seat_size_max" type="number" step="0.5" placeholder="Seat max" className="w-1/2 border rounded p-2 text-sm" />
      </div>

      <div className="text-sm">
        <p className="font-medium mb-1">Tree width</p>
        <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto">
          {Object.entries(TREE_WIDTH_LABELS).map(([k, l]) => (
            <label key={k} className="flex items-center gap-1">
              <input type="checkbox" name="tree_width" value={k} /> {l}
            </label>
          ))}
        </div>
      </div>

      <input name="price_max" type="number" placeholder="Max price ($)" className="w-full border rounded p-2 text-sm" />

      <button type="submit" disabled={saving} className="w-full bg-saddle-green text-white rounded-md py-2 font-semibold text-sm">
        {saving ? 'Saving…' : 'Save Alert'}
      </button>
    </form>
  );
}
