import { DISCIPLINE_LABELS, PANEL_FLOCKING_LABELS, TREE_WIDTH_LABELS } from '@/lib/types';
import { CONDITION_LABELS, US_STATES, type SearchCriteria } from '@/lib/search';

const field = 'w-full border rounded p-2 text-sm';
const groupLabel = 'block font-semibold mb-1 text-sm';

export default function FilterSidebar({
  brands,
  criteria
}: {
  brands: { name: string; slug: string }[];
  criteria: SearchCriteria;
}) {
  return (
    <form method="get" action="/saddles" className="bg-white border border-saddle-tan rounded-lg p-4 space-y-5 h-fit">
      <div>
        <label htmlFor="f-discipline" className={groupLabel}>Discipline</label>
        <select id="f-discipline" name="discipline" defaultValue={criteria.discipline ?? ''} className={field}>
          <option value="">Any discipline</option>
          {Object.entries(DISCIPLINE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-brand" className={groupLabel}>Brand</label>
        <select id="f-brand" name="brand" defaultValue={criteria.brand ?? ''} className={field}>
          <option value="">Any brand</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>{b.name}</option>
          ))}
        </select>
        <label htmlFor="f-model" className="sr-only">Model</label>
        <input id="f-model" name="model" placeholder="Model (e.g. Chiberta)" defaultValue={criteria.model ?? ''}
          className={`${field} mt-2`} />
      </div>

      <fieldset>
        <legend className={groupLabel}>Seat size (inches)</legend>
        <div className="flex gap-2">
          <input name="seat_min" type="number" step="0.5" min="10" max="22" placeholder="Min" aria-label="Minimum seat size"
            defaultValue={criteria.seat_min ?? ''} className="w-1/2 border rounded p-2 text-sm" />
          <input name="seat_max" type="number" step="0.5" min="10" max="22" placeholder="Max" aria-label="Maximum seat size"
            defaultValue={criteria.seat_max ?? ''} className="w-1/2 border rounded p-2 text-sm" />
        </div>
      </fieldset>

      <fieldset>
        <legend className={groupLabel}>Tree width</legend>
        <p className="text-xs text-gray-500 mb-1">As reported by the seller</p>
        <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
          {Object.entries(TREE_WIDTH_LABELS).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" name="tree" value={k} defaultChecked={criteria.tree?.includes(k as any)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={groupLabel}>Price ($)</legend>
        <div className="flex gap-2">
          <input name="price_min" type="number" min="0" placeholder="Min" aria-label="Minimum price"
            defaultValue={criteria.price_min ?? ''} className="w-1/2 border rounded p-2 text-sm" />
          <input name="price_max" type="number" min="0" placeholder="Max" aria-label="Maximum price"
            defaultValue={criteria.price_max ?? ''} className="w-1/2 border rounded p-2 text-sm" />
        </div>
      </fieldset>

      <fieldset>
        <legend className={groupLabel}>Condition</legend>
        <div className="space-y-1 text-sm">
          {Object.entries(CONDITION_LABELS).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" name="condition" value={k} defaultChecked={criteria.condition?.includes(k as any)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="f-state" className={groupLabel}>Location</label>
        <select id="f-state" name="state" defaultValue={criteria.state ?? ''} className={field}>
          <option value="">Anywhere</option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={groupLabel}>Panels</legend>
        <div className="space-y-1 text-sm">
          {Object.entries(PANEL_FLOCKING_LABELS).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" name="panels" value={k} defaultChecked={criteria.panels?.includes(k as any)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="f-flap" className={groupLabel}>Flap / panel</label>
        <input id="f-flap" name="flap" placeholder="e.g. monoflap, long" defaultValue={criteria.flap ?? ''} className={field} />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="unknown" value="1" defaultChecked={!!criteria.include_unknown} className="mt-1" />
        <span>
          Include saddles where the seller didn&apos;t state condition, location, panels or flap
        </span>
      </label>

      <button type="submit" className="w-full bg-saddle-green text-white rounded-md py-2 font-semibold">
        Apply Filters
      </button>
      <a href="/saddles" className="block text-center text-sm underline text-gray-600">Clear all</a>
    </form>
  );
}
