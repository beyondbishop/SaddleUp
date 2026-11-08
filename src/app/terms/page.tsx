import { SELLER_FEE_CAP_DOLLARS, SELLER_FEE_PERCENT } from '@/lib/fees';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto prose">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-6">
        {/* Draft wording: have a lawyer review this before relying on it. */}
        Last updated November 6, 2026
      </p>

      <h2 className="font-semibold mt-6 mb-2">1. What SaddleUp Is</h2>
      <p>
        SaddleUp is a marketplace that connects buyers and sellers of used saddles. We are not
        a party to the sale itself — the contract of sale is between the buyer and seller. We
        facilitate payment processing, hold funds during an inspection period, and charge sellers
        a commission of {SELLER_FEE_PERCENT}% of the sale price during our beta, capped at $
        {SELLER_FEE_CAP_DOLLARS} per transaction.
      </p>

      <h2 className="font-semibold mt-6 mb-2">2. Inspection / Trial Window</h2>
      <p>
        Funds from a completed purchase are held by SaddleUp for up to 5 days after delivery.
        During this window, buyers may confirm receipt to release payment early, or contact
        SaddleUp with a concern about the item's condition or accuracy of the listing. If no
        action is taken within the window, payment is automatically released to the seller.
      </p>
      <p className="mt-3">
        If a buyer returns a saddle during the inspection window, the buyer pays return shipping,
        unless the saddle isn&apos;t as described in the listing; then the seller pays it.
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

      <h2 id="text-messages" className="font-semibold mt-6 mb-2 scroll-mt-6">7. Text Message Alerts</h2>
      <p>
        SaddleUp Alerts is an optional text message program. If you add your cell phone, confirm it with a code, and
        tick the box agreeing to texts on your profile page, we text you when a buyer or seller messages you about a
        saddle, and with updates about your orders (payment, shipping, delivery, inspection deadlines, returns and
        payouts). We don&apos;t send marketing texts.
      </p>
      <ul className="list-disc pl-5 mt-2 space-y-1">
        <li>Message frequency varies with your activity on SaddleUp.</li>
        <li>Message and data rates may apply.</li>
        <li>Reply <strong>STOP</strong> to stop texts at any time, or turn them off on your profile page. Reply <strong>HELP</strong> for help.</li>
        <li>Questions? Email <a href="mailto:hello@saddleup.me" className="underline">hello@saddleup.me</a>.</li>
        <li>Carriers are not liable for delayed or undelivered messages.</li>
        <li>Agreeing to texts is not a condition of buying or selling.</li>
      </ul>
      <p className="mt-2">
        See our <a href="/privacy#text-messages" className="underline">Privacy Policy</a> for how we handle your phone number.
      </p>
    </div>
  );
}
