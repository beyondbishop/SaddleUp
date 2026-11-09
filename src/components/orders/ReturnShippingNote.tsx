const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Tells the buyer they pay return shipping if they send the saddle back, with an estimate.
 * The estimate is the shipping they paid: same box, same route reversed, insured for the same price.
 */
export default function ReturnShippingNote({ shippingCents, className = '' }: { shippingCents?: number | null; className?: string }) {
  return (
    <p className={`text-sm bg-saddle-cream border border-saddle-tan rounded p-3 ${className}`}>
      <span className="font-semibold">If it doesn&apos;t work out:</span> you can send the saddle back during the 5-day
      trial for a refund. You pay return shipping
      {shippingCents ? (
        <>
          , which should be about <span className="font-semibold">{usd(shippingCents)}</span> (the same box, insured, going
          the other way)
        </>
      ) : null}
      . If the saddle isn&apos;t as described, the seller pays it instead.
    </p>
  );
}
