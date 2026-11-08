'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PANEL_FLOCKING_LABELS, TREE_WIDTH_LABELS, TRIAL_POLICY_LABELS, Listing, type TrialPolicy } from '@/lib/types';
import slugify from 'slugify';
import ZipField from './ZipField';
import PhotoUploader from './PhotoUploader';
import PriceSuggest from './PriceSuggest';
import ListingHelper, { type HelperChange } from './ListingHelper';
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

/** POST to one of our API routes, giving up after `ms` so the form can never hang on "Saving…". */
async function postWithTimeout(url: string, body: BodyInit, ms = 30_000, json = true) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      method: 'POST',
      body,
      signal: controller.signal,
      ...(json ? { headers: { 'Content-Type': 'application/json' } } : {})
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data } as { ok: boolean; data: Record<string, any> };
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === 'AbortError';
    return {
      ok: false,
      data: {
        error: timedOut
          ? 'Saving took too long — check your connection and try again.'
          : "Couldn't reach SaddleUp — check your connection and try again."
      }
    };
  } finally {
    clearTimeout(timer);
  }
}

const field = 'w-full border border-saddle-line rounded p-2 bg-saddle-paper disabled:opacity-50';

export default function ListingForm({
  brands,
  existing,
  prefill,
  prefillImages,
  ebaySource,
  onSeeded,
  importMeta,
  readerNotes,
  afterSave = '/dashboard'
}: {
  brands: { id: number; name: string }[];
  existing?: Listing;
  prefill?: ListingPrefill;
  prefillImages?: string[];
  ebaySource?: EbaySource;
  /**
   * Admin "quick add" mode: saves a listing with no seller (status 'unclaimed', shown on the site, messages go to SaddleUp) and hands
   * back its claim token instead of redirecting. Photos are optional; the seller can add or change them after claiming.
   */
  onSeeded?: (listing: { id: string; claim_token: string; saddle: string; price: number; hasPhotos: boolean }) => void;
  /** Quick add: where the saddle was found and the seller's name, recorded with the import. */
  importMeta?: { sourceUrl?: string; sellerName?: string };
  /** Where to go after a successful save (admins editing a seller's listing go back to the review queue). */
  afterSave?: string;
  /** What the AI reader noticed (photo notes, warnings, missing fields), for the listing helper. */
  readerNotes?: { findings?: string[]; warnings?: string[]; missing?: string[] };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setErrorText] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // Show errors next to the Save button (and scroll to them) so they can't be missed.
  const setError = (message: string | null) => {
    setErrorText(message);
    if (message) setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };
  const [images, setImages] = useState<string[]>(existing?.images ?? prefillImages ?? []);

  // When editing a listing that already exists, save photo changes right away (add, remove,
  // reorder) so they're never lost if the person forgets — or their phone misses — "Save Changes".
  const [photoSave, setPhotoSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const savedImages = useRef(JSON.stringify(existing?.images ?? []));
  useEffect(() => {
    if (!existing) return;
    const json = JSON.stringify(images);
    if (json === savedImages.current) return;
    const timer = setTimeout(async () => {
      setPhotoSave('saving');
      const { ok } = await postWithTimeout(
        '/api/listings/save',
        JSON.stringify({ mode: 'update', id: existing.id, listing: { images } })
      );
      if (ok) savedImages.current = json;
      setPhotoSave(ok ? 'saved' : 'error');
    }, 600);
    return () => clearTimeout(timer);
  }, [images, existing]);

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

  // ---------- Listing helper: read the form for it, and apply its changes ----------
  const formRef = useRef<HTMLFormElement>(null);

  function el(name: string) {
    return formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | RadioNodeList | null;
  }

  /** Current value of a form field (radio groups included). */
  function valueOf(name: string): string {
    if (name === 'discipline') return discipline;
    if (name === 'brand_id') return brandId;
    if (name === 'seat_size') return seat;
    if (name === 'tree_width') return tree;
    const e = el(name);
    if (!e) return '';
    return (e as any).value ?? '';
  }

  function helperContext() {
    const form: Record<string, string> = {};
    const options: Record<string, string[]> = {};
    for (const name of HELPER_FIELDS) {
      const v = valueOf(name);
      if (!v) continue;
      const e = el(name);
      const label =
        name === 'brand_id' ? brands.find((b) => String(b.id) === v)?.name
        : e instanceof HTMLSelectElement ? e.selectedOptions[0]?.textContent ?? undefined
        : undefined;
      form[name] = label && label !== v ? `${v} (${label})` : v;
    }
    options.discipline = DISCIPLINE_CHOICES.map((d) => `${d.value}: ${d.label}`);
    options.brand_id = (discipline ? brandOptions : brands).map((b) => `${b.id}: ${b.name}`);
    options.seat_size = (discipline ? seatOptions : []).map((n) => `${n}: ${formatSeat(n)}`);
    options.tree_width = (discipline ? treeOptions : []).map((t) => `${t.value}: ${t.label}`);
    options.trial_policy = Object.entries(TRIAL_POLICY_LABELS).map(([k, v]) => `${k}: ${v}`);
    for (const name of HELPER_FIELDS) {
      const e = el(name);
      if (options[name] || !(e instanceof HTMLSelectElement)) continue;
      options[name] = Array.from(e.options).filter((o) => o.value).map((o) => `${o.value}: ${o.textContent}`);
    }
    // Required fields still empty, in the form's own words.
    const missing = new Set(readerNotes?.missing ?? []);
    for (const name of ['discipline', 'brand_id', 'model', 'seat_size', 'tree_width', 'price']) {
      if (!valueOf(name)) missing.add(HELPER_LABELS[name] ?? name);
    }
    return {
      form,
      options,
      findings: readerNotes?.findings ?? [],
      warnings: readerNotes?.warnings ?? [],
      missing: Array.from(missing)
    };
  }

  /** Set an input/select/textarea the way typing would, so React and any listeners see it. */
  function setNative(e: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
    const proto = e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(e, value);
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Write one field. Returns false when the value isn't allowed for that field. */
  function writeField(name: string, value: string): boolean {
    if (name === 'discipline') {
      if (!DISCIPLINE_CHOICES.some((d) => d.value === value)) return false;
      chooseDiscipline(value as Discipline);
      return true;
    }
    if (name === 'brand_id') {
      const b = brands.find((x) => String(x.id) === value || x.name.toLowerCase() === value.toLowerCase());
      if (!b) return false;
      setBrandId(String(b.id));
      return true;
    }
    if (name === 'seat_size') {
      if (!(Number(value) > 0)) return false;
      setSeat(String(Number(value)));
      return true;
    }
    if (name === 'tree_width') {
      if (!(value in TREE_WIDTH_LABELS)) return false;
      setTree(value);
      return true;
    }
    const e = el(name);
    if (!e) return false;
    if (e instanceof RadioNodeList) {
      const radio = Array.from(e).find((r) => (r as HTMLInputElement).value === value) as HTMLInputElement | undefined;
      if (!radio) return false;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (e instanceof HTMLSelectElement && value && !Array.from(e.options).some((o) => o.value === value)) return false;
    setNative(e, value);
    return true;
  }

  function flash(names: string[]) {
    // Wait a beat so fields enabled by a discipline change have rendered.
    setTimeout(() => {
      for (const name of names) {
        const e = el(name);
        const target = e instanceof RadioNodeList ? (e[0] as HTMLElement | undefined)?.closest('fieldset') : (e as HTMLElement | null);
        if (!target) continue;
        target.classList.add('ring-2', 'ring-saddle-gold', 'transition-shadow');
        setTimeout(() => target.classList.remove('ring-2', 'ring-saddle-gold'), 2500);
      }
    }, 50);
  }

  function applyHelperChanges(changes: HelperChange[]) {
    // Discipline first: it decides which brands, seats and trees are allowed.
    const ordered = [...changes].sort((a, b) => (a.field === 'discipline' ? -1 : b.field === 'discipline' ? 1 : 0));
    const before: HelperChange[] = [];
    const done: string[] = [];
    for (const c of ordered) {
      const previous = valueOf(c.field);
      if (previous === c.value) continue;
      if (writeField(c.field, c.value)) {
        before.push({ field: c.field, value: previous });
        done.push(c.field);
      }
    }
    flash(done);
    return {
      changed: done.map((f) => HELPER_LABELS[f] ?? f),
      undo: () => {
        for (const c of [...before].reverse()) writeField(c.field, c.value);
        flash(before.map((c) => c.field));
      }
    };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!discipline) {
      setError('Choose the saddle’s discipline first.');
      return;
    }
    setSaving(true);
    setError(null);

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
      brand_id: brandId,
      model,
      discipline: form.get('discipline'),
      seat_size: seatSize,
      tree_width: form.get('tree_width'),
      panel_type: form.get('panel_type') || null,
      panel_flocking: form.get('panel_flocking') || null,
      flap_length: form.get('flap_length') || null,
      year_manufactured: form.get('year_manufactured') ? Number(form.get('year_manufactured')) : null,
      condition: form.get('condition') || null,
      color: form.get('color') || null,
      price_cents: Math.round(price * 100),
      description: form.get('description'),
      tree_width_cm: form.get('tree_width_cm') ? Number(form.get('tree_width_cm')) : null,
      panel_length_cm: form.get('panel_length_cm') ? Number(form.get('panel_length_cm')) : null,
      location_city: form.get('location_city') || null,
      location_state: form.get('location_state') ? String(form.get('location_state')).trim().toUpperCase().slice(0, 2) : null,
      location_zip: form.get('location_zip') || null,
      pkg_length_in: form.get('pkg_length_in') ? Number(form.get('pkg_length_in')) : null,
      pkg_width_in: form.get('pkg_width_in') ? Number(form.get('pkg_width_in')) : null,
      pkg_height_in: form.get('pkg_height_in') ? Number(form.get('pkg_height_in')) : null,
      pkg_weight_lb: form.get('pkg_weight_lb') ? Number(form.get('pkg_weight_lb')) : null,
      ...(form.get('trial_policy') ? { trial_policy: form.get('trial_policy') } : existing ? { trial_policy: null } : {}),
      images,
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

    const mode = existing ? 'update' : onSeeded ? 'seed' : 'create';
    const { ok, data } = await postWithTimeout(
      '/api/listings/save',
      JSON.stringify({ mode, id: existing?.id, listing: payload, ...(mode === 'seed' ? { import: importMeta ?? {} } : {}) })
    );
    setSaving(false);
    if (!ok) return setError(data.error ?? "Couldn't save — please try again.");

    // Work out the saddle's fair price range for its public page, without making anyone wait.
    // (Reuses the price check already done for this form when the details haven't changed.)
    const savedId = existing?.id ?? data.id;
    if (savedId) fetch(`/api/listings/${savedId}/price-range`, { method: 'POST', keepalive: true }).catch(() => {});

    if (mode === 'seed') {
      const brandName = brands.find((b) => b.id === brandId)?.name;
      onSeeded!({
        id: data.id,
        claim_token: data.claim_token,
        saddle: `${seatSize}" ${brandName && brandName !== 'Other' ? `${brandName} ` : ''}${model}`,
        price,
        hasPhotos: images.length > 0
      });
      return;
    }

    router.push(afterSave);
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      // The browser blocks submit when a required field is empty; say which one, next to the button.
      onInvalidCapture={(e) => {
        const el = e.target as HTMLInputElement;
        const label = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null;
        setError(`Please fill in ${label ?? el.name.replace(/_/g, ' ')}.`);
      }}
      className="max-w-2xl space-y-4"
    >
      <ListingHelper
        getContext={helperContext}
        apply={applyHelperChanges}
        // Start the conversation by itself when the reader left things to check.
        autoStart={!existing && !!(readerNotes?.warnings?.length || readerNotes?.missing?.length)}
      />

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
          <label htmlFor="panel_flocking" className="block text-sm font-semibold mb-1">Panels</label>
          <select
            id="panel_flocking"
            name="panel_flocking"
            defaultValue={existing?.panel_flocking ?? prefill?.panel_flocking ?? ''}
            className={field}
          >
            <option value="">Not sure</option>
            {Object.entries(PANEL_FLOCKING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
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
          <input name="tree_width_cm" type="number" step="0.1" defaultValue={(existing as any)?.tree_width_cm ?? prefill?.tree_width_cm ?? ''} className="w-full border rounded p-2" />
          <p className="text-xs text-gray-500 mt-1">Fill this in if you know it — it powers the horse-fit matcher.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Panel Length (cm, optional)</label>
          <input name="panel_length_cm" type="number" step="0.1" defaultValue={(existing as any)?.panel_length_cm ?? prefill?.panel_length_cm ?? ''} className="w-full border rounded p-2" />
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-semibold mb-1">Packed box size (optional)</legend>
        <p className="text-xs text-gray-500 mb-2">
          Used to quote buyers shipping. Leave blank for a standard saddle box (28 × 20 × 14 in, 25 lb). If your box is
          bigger or heavier than you enter, the difference in shipping comes out of your payout.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            ['pkg_length_in', 'Length (in)', 6, 80],
            ['pkg_width_in', 'Width (in)', 6, 80],
            ['pkg_height_in', 'Height (in)', 3, 80],
            ['pkg_weight_lb', 'Weight (lb)', 1, 150]
          ] as const).map(([name, label, min, max]) => (
            <label key={name} className="text-xs">
              <span className="block mb-1">{label}</span>
              <input name={name} type="number" step="0.5" min={min} max={max}
                defaultValue={(existing as any)?.[name] ?? ''} className="w-full border rounded p-2 text-sm" />
            </label>
          ))}
        </div>
      </fieldset>

      <ZipField
        initialZip={existing?.location_zip ?? prefill?.location_zip}
        initialCity={existing?.location_city ?? prefill?.location_city}
        initialState={existing?.location_state ?? prefill?.location_state}
        className={field}
      />

      <fieldset>
        <legend className="block text-sm font-semibold mb-1">Trials</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.entries(TRIAL_POLICY_LABELS) as [TrialPolicy, string][]).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm bg-saddle-paper border border-saddle-line rounded p-2.5 cursor-pointer">
              <input
                type="radio"
                name="trial_policy"
                value={value}
                defaultChecked={(existing?.trial_policy ?? prefill?.trial_policy) === value}
              />
              {label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm bg-saddle-paper border border-saddle-line rounded p-2.5 cursor-pointer">
            <input type="radio" name="trial_policy" value="" defaultChecked={!(existing?.trial_policy ?? prefill?.trial_policy)} />
            Not sure / ask me
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="price" className="block text-sm font-semibold mb-1">Price (USD)</label>
        <input id="price" name="price" type="number" min={1} step="any" required defaultValue={existing ? existing.price_cents / 100 : prefill?.price ?? ''} className={field} />
        {/* Check prices automatically when the form arrives filled in (import, eBay, home-page check). */}
        <PriceSuggest auto={!existing && !!(prefill?.brand_id || prefill?.model)} />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Description</label>
        <textarea name="description" rows={5} defaultValue={existing?.description ?? prefill?.description ?? ''} className="w-full border rounded p-2" />
      </div>

      <div>
        {onSeeded && (
          <p className="text-xs text-saddle-muted mb-1">
            Optional. Photos here go on the listing, so the seller sees their saddle when they claim it and can add or change them.
          </p>
        )}
        <PhotoUploader images={images} setImages={setImages} />
        {existing && photoSave !== 'idle' && (
          <p className={`text-sm mt-1 ${photoSave === 'error' ? 'text-red-700' : 'text-saddle-green'}`}>
            {photoSave === 'saving' && 'Saving photos…'}
            {photoSave === 'saved' && 'Photos saved ✓'}
            {photoSave === 'error' && "Couldn't save photo changes — click Save Changes below to try again."}
          </p>
        )}
      </div>

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

      {error && (
        <p ref={errorRef} role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </p>
      )}

      <button type="submit" disabled={saving} className="bg-saddle-green text-white px-6 py-3 rounded-md font-semibold">
        {saving ? 'Saving…' : existing ? 'Save Changes' : onSeeded ? 'Create listing + claim link' : 'Publish Listing'}
      </button>
    </form>
  );
}

/** Fields the listing helper may read and change (names match the form inputs). */
const HELPER_FIELDS = [
  'discipline', 'brand_id', 'model', 'seat_size', 'tree_width', 'tree_width_cm', 'color', 'condition',
  'panel_flocking', 'panel_type', 'year_manufactured', 'panel_length_cm', 'trial_policy', 'price', 'description',
  'location_city', 'location_state', 'location_zip'
] as const;

const HELPER_LABELS: Record<string, string> = {
  discipline: 'discipline', brand_id: 'brand', model: 'model', seat_size: 'seat size', tree_width: 'tree width',
  tree_width_cm: 'tree (cm)', color: 'color', condition: 'condition', panel_flocking: 'panels', panel_type: 'flap / panel',
  year_manufactured: 'year', panel_length_cm: 'panel length', trial_policy: 'trial policy', price: 'price',
  description: 'description', location_city: 'city', location_state: 'state', location_zip: 'ZIP'
};
