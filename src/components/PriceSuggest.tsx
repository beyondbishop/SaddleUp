'use client';

import { useState } from 'react';

interface Range {
  low: number;
  typical: number;
  high: number;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  sources: string[];
}

const FIELDS = [
  'brand_id', 'model', 'discipline', 'seat_size', 'tree_width', 'condition', 'year_manufactured',
  'panel_type', 'panel_flocking', 'color', 'description'
] as const;

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

/**
 * "Suggest a price" under the listing form's price box: reads the saddle details already on the
 * form, asks /api/price-range, and shows low / typical / high. Clicking one fills the price.
 */
export default function PriceSuggest() {
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [form, setForm] = useState<HTMLFormElement | null>(null);

  async function suggest(e: React.MouseEvent<HTMLButtonElement>) {
    const f = e.currentTarget.form;
    if (!f) return;
    setForm(f);
    const data = new FormData(f);
    const body: Record<string, string> = {};
    for (const k of FIELDS) {
      // Disabled fields (e.g. tree before discipline is chosen) aren't in FormData; read them directly.
      const v = data.get(k) ?? (f.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null)?.value;
      if (typeof v === 'string' && v.trim()) body[k] = v;
    }
    if (!body.brand_id && !body.model) {
      setError('Choose the brand (and model if you know it) first.');
      return;
    }
    setLoading(true);
    setError(null);
    setRange(null);
    setPicked(null);
    try {
      const res = await fetch('/api/price-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(70_000)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't estimate a price right now.");
      setRange(json);
    } catch (err) {
      setError(err instanceof Error && err.name !== 'TimeoutError' ? err.message : 'That took too long. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  function use(n: number) {
    const input = form?.elements.namedItem('price') as HTMLInputElement | null;
    if (input) {
      input.value = String(n);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setPicked(n);
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={suggest}
        disabled={loading}
        className="text-sm font-semibold text-saddle-brown underline disabled:opacity-60 disabled:no-underline"
      >
        {loading ? 'Checking current prices…' : range ? 'Suggest again' : '💡 Suggest a price range'}
      </button>
      {loading && <p className="text-xs text-saddle-muted mt-1">Looking up what saddles like this sell for. This can take up to 30 seconds.</p>}
      {error && <p className="text-sm text-red-700 mt-1">{error}</p>}
      {range && (
        <div className="mt-2 rounded border border-saddle-line bg-saddle-paper p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['Low', range.low, 'Sells quickly'],
                ['Typical', range.typical, 'Fair asking price'],
                ['High', range.high, 'Top of the market']
              ] as const
            ).map(([label, n, hint]) => (
              <button
                key={label}
                type="button"
                onClick={() => use(n)}
                className={`rounded border p-2 text-center transition-colors ${
                  picked === n ? 'border-saddle-green bg-saddle-green/10' : 'border-saddle-line bg-white hover:border-saddle-brown'
                }`}
              >
                <span className="block text-xs font-mono uppercase tracking-[0.12em] text-saddle-gold">{label}</span>
                <span className="block font-serif text-lg text-saddle-ink">{usd(n)}</span>
                <span className="block text-[11px] text-saddle-muted">{picked === n ? '✓ Price set' : hint}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-saddle-ink">{range.reasoning}</p>
          <p className="text-xs text-saddle-muted">
            An AI estimate{range.sources.length ? ` from ${range.sources.join(', ').toLowerCase()}` : ''}
            {range.confidence === 'low' ? '. Low confidence, so treat it as a rough guide' : ''}. Click a price to use it; you set the final price.
          </p>
        </div>
      )}
    </div>
  );
}
