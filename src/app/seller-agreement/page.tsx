export const metadata = { title: 'Seller Agreement' };

export default function SellerAgreementPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto prose">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">Seller Agreement</h1>
      <p className="text-sm text-gray-500 mb-6">
        Placeholder template — have a lawyer review and customize this before launch.
      </p>

      <h2 className="font-semibold mt-6 mb-2">Commission</h2>
      <p>
        SaddleUp charges a commission of 20% of the final sale price, capped at $500 per
        transaction. This is deducted before your payout — you never receive an invoice.
      </p>

      <h2 className="font-semibold mt-6 mb-2">Payout Timing</h2>
      <p>
        Payment is held for up to 5 days after a sale to allow the buyer an inspection window.
        Once the buyer confirms receipt, or the window elapses without a dispute, funds are
        transferred to your connected Stripe account, typically arriving within 2 business days.
      </p>

      <h2 className="font-semibold mt-6 mb-2">Listing Standards</h2>
      <p>
        You agree to list only saddles you have the right to sell, to describe their condition
        accurately, and to disclose any known defects, repairs, or damage. Misrepresented
        listings may be removed and repeat violations may result in account suspension.
      </p>

      <h2 className="font-semibold mt-6 mb-2">Disputes</h2>
      <p>
        If a buyer disputes the condition or accuracy of a listing during the inspection
        window, SaddleUp may place the payout on hold pending review before releasing or
        refunding funds.
      </p>
    </div>
  );
}
