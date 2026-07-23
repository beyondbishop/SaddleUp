export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto prose">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-6">
        Placeholder template — have a lawyer review and customize this before launch.
      </p>

      <h2 className="font-semibold mt-6 mb-2">1. What SaddleUp Is</h2>
      <p>
        SaddleUp is a marketplace that connects buyers and sellers of used saddles. We are not
        a party to the sale itself — the contract of sale is between the buyer and seller. We
        facilitate payment processing, hold funds during an inspection period, and charge sellers
        a commission of 20% of the sale price, capped at $500 per transaction.
      </p>

      <h2 className="font-semibold mt-6 mb-2">2. Inspection / Trial Window</h2>
      <p>
        Funds from a completed purchase are held by SaddleUp for up to 5 days after delivery.
        During this window, buyers may confirm receipt to release payment early, or contact
        SaddleUp with a concern about the item's condition or accuracy of the listing. If no
        action is taken within the window, payment is automatically released to the seller.
      </p>

      <h2 className="font-semibold mt-6 mb-2">3. Seller Responsibilities</h2>
      <p>
        Sellers are responsible for accurately describing the saddle's condition, tree width,
        seat size, and any defects. Misrepresenting a listing may result in removal from the
        platform and, where a sale has occurred, a refund to the buyer.
      </p>

      <h2 className="font-semibold mt-6 mb-2">4. Prohibited Listings</h2>
      <p>
        Counterfeit or misrepresented brand-name saddles are strictly prohibited. SaddleUp
        reserves the right to remove any listing and suspend any account at its discretion.
      </p>

      <h2 className="font-semibold mt-6 mb-2">5. Limitation of Liability</h2>
      <p>
        SaddleUp is not responsible for the fit, safety, or suitability of any saddle for any
        horse or rider. Buyers are strongly encouraged to have any saddle professionally
        fit-checked after purchase.
      </p>

      <h2 className="font-semibold mt-6 mb-2">6. Taxes</h2>
      <p>
        Depending on your state, SaddleUp may be required to collect and remit sales tax as a
        marketplace facilitator. Sellers remain responsible for any income tax obligations
        arising from sales made through the platform.
      </p>
    </div>
  );
}
