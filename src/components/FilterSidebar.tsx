import { DISCIPLINE_LABELS, TREE_WIDTH_LABELS } from '@/lib/types';

export default function FilterSidebar({
  brands,
  searchParams
}: {
  brands: { name: string; slug: string }[];
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const selectedTrees = Array.isArray(searchParams.tree)
    ? searchParams.tree
    : searchParams.tree
    ? [searchParams.tree]
    : [];
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  return (
    <form method="get" action="/saddles" className="bg-white border border-saddle-tan rounded-lg p-4 space-y-5 h-fit">
      <div>
        <label className="block font-semibold mb-1 text-sm">Discipline</label>
        <select name="discipline" defaultValue={one(searchParams.discipline)} className="w-full border rounded p-2 text-sm">
          <option value="">Any Discipline</option>
          {Object.entries(DISCIPLINE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-semibold mb-1 text-sm">Brand</label>
        <select name="brand" defaultValue={one(searchParams.brand)} className="w-full border rounded p-2 text-sm">
          <option value="">Any Brand</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>{b.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-semibold mb-1 text-sm">Seat Size</label>
        <div className="flex gap-2">
          <input name="seat_min" type="number" step="0.5" placeholder="Min" defaultValue={one(searchParams.seat_min)}
            className="w-1/2 border rounded p-2 text-sm" />
          <input name="seat_max" type="number" step="0.5" placeholder="Max" defaultValue={one(searchParams.seat_max)}
            className="w-1/2 border rounded p-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block font-semibold mb-1 text-sm">Tree Width</label>
        <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
          {Object.entries(TREE_WIDTH_LABELS).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" name="tree" value={k} defaultChecked={selectedTrees.includes(k)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block font-semibold mb-1 text-sm">Max Price</label>
        <input name="price_max" type="number" placeholder="$" defaultValue={one(searchParams.price_max)}
          className="w-full border rounded p-2 text-sm" />
      </div>

      <button type="submit" className="w-full bg-saddle-green text-white rounded-md py-2 font-semibold">
        Apply Filters
      </button>
    </form>
  );
}
