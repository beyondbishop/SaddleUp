'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TREE_WIDTH_LABELS, Listing } from '@/lib/types';
import slugify from 'slugify';
import type { EbaySource, ListingPrefill } from '@/lib/ebay/map';
import {
  DISCIPLINE_CHOICES,
  brandsForDiscipline,
  formatSeat,
  modelsFor,
  seatSizesFor,
  treeLabelFor,
  treeOptionsFor
} from '@/lib/saddle-catalog';
import type { Discipline } from '@/lib/types';

const field = 'w-full border border-saddle-line rounded p-2 bg-saddle-paper disabled:opacity-50';

export default function ListingForm({
  brands,
  existing,
  prefill,
  prefillImages,
  ebaySource,
  onSeeded
}: {
  brands: { id: number; name: string }[];
  existing?: Listing;
  prefill?: ListingPrefill;
  prefillImages?: string[];
  ebaySource?: EbaySource;
  /**
   * Admin "quick add" mode: saves a HIDDEN listing with no seller (status 'unclaimed') and hands
   * back its claim token instead of redirecting. The seller adds their own photos when they claim.
   */
  onSeeded?: (listing: { id: string; claim_token: string; saddle: string }) => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>(existing?.images ?? prefillImages ?? []);
  const [uploading, setUploading] = useState(false);

  // The discipline is chosen first and drives everything else: English vs Western brands,
  // model suggestions, seat sizes and tree widths.
  const [discipline, setDiscipline] = useState<Discipline | ''>(existing?.discipline ?? prefill?.discipline ?? '');
  const [brandId, setBrandId] = useState(String(existing?.brand_id ?? prefill?.brand_id ?? ''));
  const [seat, setSeat] = useState(String(existing?.seat_size ?? prefill?.seat_size ?? ''));
  const [tree, setTree] = useState<string>(existing?.tree_width ?? prefill?.tree_width ?? '');

  const brandOptions = brandsForDiscipline(brands, discipline);
  const seatOptions = seatSizesFor(discipline);
  const treeOptions = treeOptionsFor(discipline);
  const selectedBrand = brands.find((b) => String(b.id) === brandId);
  const modelSuggestions = modelsFor(selectedBrand?.name, discipline);

  function chooseDiscipline(d: Discipline) {
    setDiscipline(d);
    // Clear anything that doesn't fit the new discipline (e.g. an English brand after picking Western).
    if (brandId && !brandsForDiscipline(brands, d).some((b) => String(b.id) === brandId)) setBrandId('');
    if (seat && !seatSizesFor(d).includes(Number(seat))) setSeat('');
    if (tree && !treeOptionsFor(d).some((t) => t.value === tree)) setTree('');
  }

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
    if (!discipline) {
      setError('Choose the saddle’s discipline first.');
      return;
    }
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
      seller_id: onSeeded ? null : user.id,
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
      status: existing ? existing.status : onSeeded ? 'unclaimed' : 'draft',
      ...(onSeeded ? { source: 'seeded' } : {}),
      slug: existing?.slug ?? `${slugBase}-${Math.random().toString(36).slice(2, 7)}`,
      ...(ebaySource && !existing
        ? {
            source: 'ebay_import',
            ebay_item_id: ebaySource.item_id,
            ebay_item_url: ebaySource.url,
            ebay_seller_username: ebaySource.seller_username,
            ebay_imported_at: new Date().toISOString()
          }
        : {})
    };

    if (onSeeded && !existing) {
      const { data: seeded, error: seedError } = await supabase
        .from('listings')
        .insert(payload)
        .select('id, claim_token')
        .single();
      setSaving(false);
      if (seedError || !seeded) return setError(seedError?.message ?? 'Could not save.');
      const brandName = brands.find((b) => b.id === brandId)?.name;
      onSeeded({
        id: seeded.id,
        claim_token: seeded.claim_token,
        saddle: `${seatSize}" ${brandName && brandName !== 'Other' ? `${brandName} ` : ''}${model}`
      });
      return;
    }

    const query = existing
      ? supabase.from('listings').update(payload).eq('id', existing.id)
      : supabase.from('listings').insert(payload);

    const { error: saveError } = await query;
    setSaving(false);
    if (saveError) {
      return setError(
        saveError.code === '23505' && ebaySource
          ? 'That eBay listing has already been imported to SaddleUp.'
          : saveError.message
      );
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <fieldset>
        <legend className="block text-sm font-semibold mb-2">What discipline is the saddle for?</legend>
        <input type="hidden" name="discipline" value={discipline} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DISCIPLINE_CHOICES.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => chooseDiscipline(d.value)}
              aria-pressed={discipline === d.value}
              className={`text-left px-3 py-2.5 rounded-sm border transition-colors ${
                discipline === d.value
                  ? 'bg-saddle-brown text-saddle-cream border-saddle-brown'
                  : 'bg-saddle-paper text-saddle-ink border-saddle-line hover:border-saddle-brown'
              }`}
            >
              <span className="block font-semibold text-sm">{d.label}</span>
              <span className={`block text-xs ${discipline === d.value ? 'text-saddle-cream/80' : 'text-saddle-muted'}`}>
                {d.hint}
              </span>
            </button>
          ))}
        </div>
        {!discipline && <p className="text-xs text-saddle-muted mt-1">Pick one to see the right brands, models, sizes and widths.</p>}
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="brand_id" className="block text-sm font-semibold mb-1">Brand</label>
          <select
            id="brand_id"
            name="brand_id"
            required
            disabled={!discipline}
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className={field}
          >
            <option value="" disabled>Select brand…</option>
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {discipline && brandOptions.length <= 1 && (
            <p className="text-xs text-red-700 mt-1">Brand list didn&apos;t load — please refresh the page.</p>
          )}
        </div>
        <div>
          <label htmlFor="model" className="block text-sm font-semibold mb-1">Model</label>
          <input
            id="model"
            name="model"
            required
            disabled={!discipline}
            list="model-suggestions"
            autoComplete="off"
            placeholder={modelSuggestions.length ? `e.g. ${modelSuggestions.slice(0, 2).join(', ')}` : 'Model name'}
            defaultValue={existing?.model ?? prefill?.model}
            className={field}
          />
          <datalist id="model-suggestions">
            {modelSuggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="seat_size" className="block text-sm font-semibold mb-1">Seat Size</label>
          <select
            id="seat_size"
            name="seat_size"
            required
            disabled={!discipline}
            value={seat}
            onChange={(e) => setSeat(e.target.value)}
            className={field}
          >
            <option value="" disabled>Select…</option>
            {seatOptions.map((n) => (
              <option key={n} value={String(n)}>{formatSeat(n)}</option>
            ))}
            {seat && !seatOptions.includes(Number(seat)) && <option value={seat}>{formatSeat(Number(seat))}</option>}
          </select>
        </div>
        <div>
          <label htmlFor="tree_width" className="block text-sm font-semibold mb-1">{treeLabelFor(discipline)}</label>
          <select
            id="tree_width"
            name="tree_width"
            required
            disabled={!discipline}
            value={tree}
            onChange={(e) => setTree(e.target.value)}
            className={field}
          >
            <option value="" disabled>Select…</option>
            {treeOptions.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
            {tree && !treeOptions.some((t) => t.value === tree) && (
              <option value={tree}>{TREE_WIDTH_LABELS[tree as keyof typeof TREE_WIDTH_LABELS]}</option>
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="color" className="block text-sm font-semibold mb-1">Leather Color</label>
          <input
            id="color"
            name="color"
            list="leather-colors"
            autoComplete="off"
            placeholder="e.g. Havana (dark brown)"
            defaultValue={existing?.color ?? prefill?.color ?? ''}
            className={field}
          />
          <datalist id="leather-colors">
            {['Havana (dark brown)', 'Brown', 'Dark brown', 'Light brown', 'Black', 'Chestnut', 'Tan', 'Oak', 'Walnut'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="condition" className="block text-sm font-semibold mb-1">Condition</label>
          <select id="condition" name="condition" defaultValue={existing?.condition ?? prefill?.condition ?? ''} className={field}>
            <option value="">Select…</option>
            <option value="new">New / never used</option>
            <option value="excellent">Excellent (like new)</option>
            <option value="good">Good (normal wear)</option>
            <option value="fair">Fair (well used / needs work)</option>
            {(() => {
              const c = existing?.condition ?? prefill?.condition;
              return c && !['new', 'excellent', 'good', 'fair'].includes(c) ? <option value={c}>{c}</option> : null;
            })()}
          </select>
        </div>
        <div>
          <label htmlFor="panel_type" className="block text-sm font-semibold mb-1">Flap / Panel</label>
          <input
            id="panel_type"
            name="panel_type"
            placeholder="e.g. monoflap, 2A flap, long flap"
            defaultValue={existing?.panel_type ?? prefill?.panel_type ?? ''}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="year_manufactured" className="block text-sm font-semibold mb-1">Year Made</label>
          <input
            id="year_manufactured"
            name="year_manufactured"
            type="number"
            min={1950}
            max={new Date().getFullYear()}
            defaultValue={existing?.year_manufactured ?? prefill?.year_manufactured ?? ''}
            className={field}
          />
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
          <input name="location_city" defaultValue={existing?.location_city ?? prefill?.location_city ?? ''} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">State</label>
          <input name="location_state" defaultValue={existing?.location_state ?? prefill?.location_state ?? ''} className="w-full border rounded p-2" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Price (USD)</label>
        <input name="price" type="number" required defaultValue={existing ? existing.price_cents / 100 : prefill?.price ?? ''} className="w-full border rounded p-2" />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Description</label>
        <textarea name="description" rows={5} defaultValue={existing?.description ?? prefill?.description ?? ''} className="w-full border rounded p-2" />
      </div>

      {onSeeded ? (
        <p className="text-sm text-saddle-muted bg-saddle-paper border border-saddle-line rounded p-3">
          No photos needed — the seller adds their own when they claim the listing.
        </p>
      ) : (
      <div>
        <label className="block text-sm font-semibold mb-1">Photos</label>
        <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
        {uploading && <p className="text-sm text-gray-500">Uploading…</p>}
        <div className="flex gap-2 mt-2 flex-wrap">
          {images.map((img) => (
            <div key={img} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-20 h-20 object-cover rounded" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((i) => i !== img))}
                aria-label="Remove photo"
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-saddle-ink text-saddle-cream text-xs leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      )}

      {ebaySource && !existing && (
        <label className="flex items-start gap-2 text-sm bg-saddle-paper border border-saddle-line rounded p-3">
          <input type="checkbox" required className="mt-1" />
          <span>
            This is my own eBay listing
            {ebaySource.seller_username ? <> (eBay seller <strong>{ebaySource.seller_username}</strong>)</> : null}, and I
            have the right to use these photos and this description on SaddleUp.
          </span>
        </label>
      )}

      <button type="submit" disabled={saving} className="bg-saddle-green text-white px-6 py-3 rounded-md font-semibold">
        {saving ? 'Saving…' : existing ? 'Save Changes' : onSeeded ? 'Create hidden listing + claim link' : 'Publish Listing'}
      </button>
    </form>
  );
}
