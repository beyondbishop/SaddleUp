'use client';

import { useEffect, useRef, useState } from 'react';

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
 * With `auto`, it runs by itself as soon as the form has a brand or model (imports, eBay, the
 * home-page check), so nobody has to remember to click.
 */
export default function PriceSuggest({ auto = false }: { auto?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  const [asking, setAsking] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auto) return;
    // Let the form's prefilled values settle first.
    const timer = setTimeout(() => {
      const f = box.current?.closest('form');
      if (f && (fieldValue(f, 'brand_id') || fieldValue(f, 'model'))) run(f, true);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  async function suggest(e: React.MouseEvent<HTMLButtonElement>) {
    if (e.currentTarget.form) run(e.currentTarget.form, false);
  }

  async function run(f: HTMLFormElement, quiet: boolean) {
    setForm(f);
    const data = new FormData(f);
    const body: Record<string, string> = {};
    for (const k of FIELDS) {
      // Disabled fields (e.g. tree before discipline is chosen) aren't in FormData; read them directly.
      const v = data.get(k) ?? (f.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null)?.value;
      if (typeof v === 'string' && v.trim()) body[k] = v;
    }
    if (!body.brand_id && !body.model) {
      if (!quiet) setError('Choose the brand (and model if you know it) first.');
      return;
    }
    const current = Number(fieldValue(f, 'price'));
    setAsking(current > 0 ? current : null);
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
      // A background check that fails stays quiet; the button is still there to try again.
      if (!quiet) setError(err instanceof Error && err.name !== 'TimeoutError' ? err.message : 'That took too long. Try again in a moment.');
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
    <div ref={box} className="mt-2">
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
          {asking != null && picked == null && (
            <p className={`text-sm font-semibold ${asking > range.high ? 'text-red-800' : 'text-saddle-green'}`}>
              {asking > range.high
                ? `The asking price (${usd(asking)}) is above this range, so it may sit longer.`
                : asking < range.low
                  ? `The asking price (${usd(asking)}) is below this range - priced to sell.`
                  : `The asking price (${usd(asking)}) is within this range.`}
            </p>
          )}
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

function fieldValue(f: HTMLFormElement, name: string): string {
  const el = f.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  return el?.value?.trim() ?? '';
}
