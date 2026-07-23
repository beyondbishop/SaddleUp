'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DISCIPLINE_LABELS, TREE_WIDTH_LABELS, Listing } from '@/lib/types';
import slugify from 'slugify';

const DISCIPLINES = Object.entries(DISCIPLINE_LABELS);
const TREES = Object.entries(TREE_WIDTH_LABELS);

export default function ListingForm({
  brands,
  existing
}: {
  brands: { id: number; name: string }[];
  existing?: Listing;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();

    for (const file of Array.from(files)) {
      const path = `${user!.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('saddle-images').upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        continue;
      }
      const { data: publicUrl } = supabase.storage.from('saddle-images').getPublicUrl(path);
      setImages((prev) => [...prev, publicUrl.publicUrl]);
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be signed in.');
      setSaving(false);
      return;
    }

    const form = new FormData(e.currentTarget);
    const model = String(form.get('model'));
    const seatSize = Number(form.get('seat_size'));
    const brandId = Number(form.get('brand_id'));
    const price = Number(form.get('price'));

    const slugBase = slugify(`${seatSize}-${brands.find((b) => b.id === brandId)?.name}-${model}`, {
      lower: true,
      strict: true
    });

    const payload = {
      seller_id: user.id,
      brand_id: brandId,
      model,
      discipline: form.get('discipline'),
      seat_size: seatSize,
      tree_width: form.get('tree_width'),
      panel_type: form.get('panel_type') || null,
      flap_length: form.get('flap_length') || null,
      year_manufactured: form.get('year_manufactured') ? Number(form.get('year_manufactured')) : null,
      condition: form.get('condition') || null,
      color: form.get('color') || null,
      price_cents: Math.round(price * 100),
      description: form.get('description'),
      tree_width_cm: form.get('tree_width_cm') ? Number(form.get('tree_width_cm')) : null,
      panel_length_cm: form.get('panel_length_cm') ? Number(form.get('panel_length_cm')) : null,
      location_city: form.get('location_city') || null,
      location_state: form.get('location_state') || null,
      images,
      status: existing ? existing.status : 'draft',
      slug: existing?.slug ?? `${slugBase}-${Math.random().toString(36).slice(2, 7)}`
    };

    const query = existing
      ? supabase.from('listings').update(payload).eq('id', existing.id)
      : supabase.from('listings').insert(payload);

    const { error: saveError } = await query;
    setSaving(false);
    if (saveError) return setError(saveError.message);
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Brand</label>
          <select name="brand_id" required defaultValue={existing?.brand_id} className="w-full border rounded p-2">
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Model</label>
          <input name="model" required defaultValue={existing?.model} className="w-full border rounded p-2" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Discipline</label>
          <select name="discipline" required defaultValue={existing?.discipline} className="w-full border rounded p-2">
            {DISCIPLINES.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Seat Size (in)</label>
          <input name="seat_size" type="number" step="0.5" required defaultValue={existing?.seat_size} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Tree Width</label>
          <select name="tree_width" required defaultValue={existing?.tree_width} className="w-full border rounded p-2">
            {TREES.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Panel Type</label>
          <input name="panel_type" placeholder="regular / monoflap" defaultValue={existing?.panel_type ?? ''} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Year</label>
          <input name="year_manufactured" type="number" defaultValue={existing?.year_manufactured ?? ''} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Condition</label>
          <input name="condition" placeholder="excellent / good / fair" defaultValue={existing?.condition ?? ''} className="w-full border rounded p-2" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Tree Width — exact (cm, optional)</label>
          <input name="tree_width_cm" type="number" step="0.1" className="w-full border rounded p-2" />
          <p className="text-xs text-gray-500 mt-1">Fill this in if you know it — it powers the horse-fit matcher.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Panel Length (cm, optional)</label>
          <input name="panel_length_cm" type="number" step="0.1" className="w-full border rounded p-2" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">City</label>
          <input name="location_city" defaultValue={existing?.location_city ?? ''} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">State</label>
          <input name="location_state" defaultValue={existing?.location_state ?? ''} className="w-full border rounded p-2" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Price (USD)</label>
        <input name="price" type="number" required defaultValue={existing ? existing.price_cents / 100 : ''} className="w-full border rounded p-2" />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Description</label>
        <textarea name="description" rows={5} defaultValue={existing?.description ?? ''} className="w-full border rounded p-2" />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Photos</label>
        <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
        {uploading && <p className="text-sm text-gray-500">Uploading…</p>}
        <div className="flex gap-2 mt-2 flex-wrap">
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img} src={img} alt="" className="w-20 h-20 object-cover rounded" />
          ))}
        </div>
      </div>

      <button type="submit" disabled={saving} className="bg-saddle-green text-white px-6 py-3 rounded-md font-semibold">
        {saving ? 'Saving…' : existing ? 'Save Changes' : 'Publish Listing'}
      </button>
    </form>
  );
}
