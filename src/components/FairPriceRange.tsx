// "Fair price range" under a saddle's price: what similar used saddles are listed for, with a
// marker showing where this one sits. The range is an AI estimate from current used listings
// online (worked out on the server when the listing is saved), not SaddleUp sales data, and the
// note says so.

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export default function FairPriceRange({ price, low, high }: { price: number; low: number | null; high: number | null }) {
  if (!low || !high || high < low) return null;

  // Bar spans a little either side of the range so a price outside it still shows on the bar.
  const pad = Math.max((high - low) * 0.35, high * 0.08);
  const min = Math.max(0, Math.min(low - pad, price - pad / 2));
  const max = Math.max(high + pad, price + pad / 2);
  const pos = (n: number) => `${((n - min) / (max - min)) * 100}%`;

  const where = price > high ? 'above' : price < low ? 'below' : 'within';
  const verdict = {
    above: { text: 'Above the typical range', tone: 'text-saddle-brown' },
    within: { text: 'Within the typical range', tone: 'text-saddle-green' },
    below: { text: 'Below the typical range - a good deal', tone: 'text-saddle-green' }
  }[where];

  return (
    <section aria-label="Fair price range" className="mb-5 rounded border border-saddle-line bg-saddle-paper p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-saddle-gold">Fair price range</p>
        <p className="font-semibold text-saddle-ink">
          {usd(low)} – {usd(high)}
        </p>
      </div>
      <div className="relative h-2 my-3 rounded-full bg-saddle-line/60" aria-hidden="true">
        <div className="absolute inset-y-0 rounded-full bg-saddle-green/35" style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})` }} />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-saddle-paper bg-saddle-brown shadow"
          style={{ left: pos(price) }}
          title={`This saddle: ${usd(price)}`}
        />
      </div>
      <p className={`text-sm font-semibold ${verdict.tone}`}>
        {usd(price)} · {verdict.text}
      </p>
      <p className="text-xs text-saddle-muted mt-1">
        An AI estimate from similar used saddles listed online right now. Not an appraisal; condition and fit matter most.
      </p>
    </section>
  );
}
