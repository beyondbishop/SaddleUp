import { SELLER_FEE_CAP_DOLLARS, SELLER_FEE_PERCENT } from '@/lib/fees';
import { A, Callout, CTA, H2, H3, OL, P, UL } from '@/components/guides/Prose';
import type { Guide } from './types';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
/** SaddleUp's fee on a sale, using the same rule as checkout (percent, capped). */
const fee = (price: number) => Math.min(Math.round((price * SELLER_FEE_PERCENT) / 100), SELLER_FEE_CAP_DOLLARS);

const SELL = '/dashboard';

const faqs: Guide['faqs'] = [
  {
    q: 'Where can I sell my used English saddle?',
    a: 'Used English saddles can be sold through dedicated equestrian marketplaces such as SaddleUp, eBay, Facebook Marketplace, equestrian Facebook groups, saddle consignment businesses, and local tack shops. The best choice depends on fees, convenience, and the type of buyer you want to reach.'
  },
  {
    q: 'How much does it cost to sell a saddle online?',
    a: `Costs vary by platform. Some local sales may involve no platform fee, while online marketplaces and consignment businesses may charge a percentage of the transaction. SaddleUp's current beta selling fee is ${SELLER_FEE_PERCENT}%, including payment processing, capped at ${usd(SELLER_FEE_CAP_DOLLARS)} per sale.`
  },
  {
    q: 'Is it better to sell a saddle privately or on consignment?',
    a: 'Private selling generally gives you greater control over pricing and the transaction. Consignment offers additional services, which can include photography, marketing, buyer communication, and trial management. Compare the expected payout and services before deciding.'
  },
  {
    q: 'How long does it take to sell a used saddle?',
    a: 'There is no guaranteed timeframe. Some saddles sell quickly, while others remain listed for months. The brand, model, size, condition, asking price, photographs, and buyer demand all influence how quickly a saddle sells.'
  },
  {
    q: 'What used saddle brands are popular?',
    a: 'Well-known English saddle brands include Devoucoux, CWD, Antares, Pessoa, Butet, Voltaire Design, Stubben, Prestige, and Custom Saddlery. Demand varies by discipline, model, fit characteristics, and price.'
  },
  {
    q: 'Can I sell a saddle that has been adjusted or reflocked?',
    a: 'Yes, provided the saddle is structurally sound and its condition is accurately disclosed. Include details about any flocking adjustments, panel modifications, repairs, or alterations.'
  },
  {
    q: 'Should I clean my saddle before selling it?',
    a: "Yes. A clean, appropriately conditioned saddle generally photographs better and makes it easier for potential buyers to assess its condition. Use products suitable for the manufacturer's leather and finish. Avoid treatments that conceal wear or alter the saddle's appearance."
  },
  {
    q: "What if my saddle doesn't fit the buyer's horse?",
    a: "Returns and fitting trials depend on the terms agreed upon and the marketplace's policies. Buyers and sellers should understand these arrangements before completing a transaction. A professional saddle fitting remains important even when a saddle's listed measurements appear suitable."
  }
];

function Body() {
  return (
    <>
      <P>
        If you have a used saddle sitting in your tack room, chances are it&apos;s worth more than you think. Whether
        you&apos;ve upgraded to a new saddle, changed disciplines, or discovered that your current saddle no longer fits
        your horse, selling it can help recover a significant portion of your original investment.
      </P>
      <P>But where is the best place to sell a used saddle online?</P>
      <P>
        In 2026, riders have several options, including Facebook Marketplace, eBay, traditional saddle consignment shops,
        and specialized equestrian marketplaces like <A href="/">SaddleUp</A>. Each comes with different fees, levels of
        convenience, and potential buyers.
      </P>
      <P>
        This guide explains where to sell your used saddle, what each option costs, and how to get the most money for
        your saddle.
      </P>

      <H2 id="best-place">What is the best place to sell a used saddle online?</H2>
      <P>The best place to sell a used saddle depends on three factors:</P>
      <OL>
        <li>
          <strong>How much money you want to keep.</strong> Selling fees and consignment commissions can substantially
          reduce your payout.
        </li>
        <li>
          <strong>How much work you&apos;re willing to do.</strong> Some services handle photography, marketing, and
          shipping, while others let you manage the sale yourself.
        </li>
        <li>
          <strong>How quickly you want to sell.</strong> Finding the right buyer depends on the saddle&apos;s brand, size,
          condition, price, and exposure.
        </li>
      </OL>
      <P>
        For riders comfortable managing their own listings, a specialized online saddle marketplace can offer a
        compelling combination of targeted exposure and lower selling fees. Let&apos;s compare your options.
      </P>

      <H2 id="saddleup">1. SaddleUp: a marketplace built for buying and selling saddles</H2>
      <P>
        <A href="/">SaddleUp</A> is an online marketplace created specifically for riders who want a more straightforward
        way to buy and sell pre-owned saddles.
      </P>
      <P>
        The idea originated from a familiar equestrian frustration: owning a quality saddle that no longer fits your
        horse, then discovering how difficult and expensive it can be to resell. SaddleUp was built around a simple
        concept: <strong>riders should be able to sell quality saddles without sacrificing a large percentage of their
        value.</strong>
      </P>
      <H3>Why consider SaddleUp?</H3>
      <UL>
        <li>
          <strong>Low selling fees:</strong> During its beta period, SaddleUp charges a total selling fee of{' '}
          {SELLER_FEE_PERCENT}%, including approximately 3% for payment processing, capped at{' '}
          {usd(SELLER_FEE_CAP_DOLLARS)} per sale. Buyers pay no commission.
        </li>
        <li>
          <strong>An equestrian-focused marketplace:</strong> Listings are created for people actively interested in
          buying saddles.
        </li>
        <li>
          <strong>Search-engine visibility:</strong> Public listings are designed to be discoverable through search
          engines rather than remaining within private social media groups.
        </li>
        <li>
          <strong>Simplified listing process:</strong> Sellers can paste an existing saddle description and use automated
          tools to help populate listing details.
        </li>
        <li>
          <strong>Detailed saddle information:</strong> Photos, brand information, seat size, tree width, and condition
          details help buyers evaluate a saddle.
        </li>
      </UL>
      <H3>How much do you keep?</H3>
      <P>
        If your saddle sells for {usd(2500)}, a {SELLER_FEE_PERCENT}% selling fee equals {usd(fee(2500))}.{' '}
        <strong>Your estimated payout: {usd(2500 - fee(2500))}</strong>, before any additional shipping or other
        applicable charges.
      </P>
      <P>
        SaddleUp is particularly appealing to riders who own quality English saddles and want to reach potential buyers
        while retaining more of the sale price.
      </P>
      <CTA href={SELL}>Sell your saddle on SaddleUp →</CTA>

      <H2 id="facebook">2. Facebook Marketplace and equestrian Facebook groups</H2>
      <P>
        Facebook has become a popular place for riders to buy and sell used tack. There are numerous groups dedicated to
        English saddles, hunter/jumper equipment, dressage saddles, and specific brands.
      </P>
      <H3>Advantages</H3>
      <UL>
        <li>Free or low-cost local selling opportunities.</li>
        <li>Access to established equestrian communities.</li>
        <li>Direct communication between buyers and sellers.</li>
        <li>Potential for local pickup, eliminating shipping.</li>
      </UL>
      <H3>Disadvantages</H3>
      <UL>
        <li>Listings can quickly disappear beneath newer posts.</li>
        <li>Buyers may expect significant price negotiations.</li>
        <li>Sellers must manage messages, payment arrangements, and potential scams.</li>
        <li>Visibility often depends on the activity and membership of individual groups.</li>
        <li>Posts inside private groups generally aren&apos;t accessible to public search engines.</li>
      </UL>
      <P>
        Facebook can be particularly effective if you&apos;re selling a saddle locally or already participate in active
        equestrian groups. For broader exposure, consider also listing your saddle on a dedicated marketplace with
        publicly searchable listings.
      </P>

      <H2 id="ebay">3. eBay: a large online marketplace</H2>
      <P>
        eBay provides access to a substantial online buying audience and offers established transaction and shipping
        tools. Used saddles from brands such as Pessoa, Stubben, CWD, Devoucoux, and Antares regularly appear on the
        platform.
      </P>
      <H3>Advantages</H3>
      <UL>
        <li>Large potential buying audience.</li>
        <li>Established payment infrastructure.</li>
        <li>Shipping tools and seller management features.</li>
        <li>Opportunities to research similar listings.</li>
      </UL>
      <H3>Disadvantages</H3>
      <UL>
        <li>Selling fees vary by category and seller account.</li>
        <li>Competition from unrelated products and sellers.</li>
        <li>Sellers manage descriptions, buyer questions, and shipping.</li>
        <li>Detailed saddle-fit information may be inconsistent between listings.</li>
      </UL>
      <P>
        eBay&apos;s{' '}
        <A href="https://www.ebay.com/help/selling/fees-credits-invoices/fee-tables?id=4822">published fee schedule</A>{' '}
        includes percentage-based final value fees and, in some cases, additional per-order charges. Always review the
        current fee for your specific listing category before posting. For sellers comfortable managing online
        transactions, eBay remains an option worth considering.
      </P>

      <H2 id="consignment">4. Traditional saddle consignment shops</H2>
      <P>
        Consignment shops handle much of the selling process for you. Depending on the business, this may include
        inspecting the saddle, photographing it, recommending a price, advertising it, arranging trials, and managing
        shipping. In exchange, the shop retains an agreed percentage of the sale.
      </P>
      <H3>How much does saddle consignment cost?</H3>
      <P>Fees vary considerably. For example:</P>
      <UL>
        <li>
          <strong>
            <A href="https://midwestsaddlecompany.com/pages/sell">Midwest Saddle Company</A>:
          </strong>{' '}
          publishes a 15% consignment fee, subject to a $50 minimum.
        </li>
        <li>
          <strong>
            <A href="https://saddlegallery.com/pages/consign-your-saddle">Saddle Gallery</A>:
          </strong>{' '}
          publishes a 30% consignment fee.
        </li>
      </UL>
      <P>
        These are examples of published rates as of November 2026. Individual agreements, additional charges, and
        policies may differ.
      </P>
      <P>
        Consignment can make sense for riders who prefer someone else to handle the sales process, particularly for
        high-value saddles requiring specialized buyer assistance. However, the convenience comes at a cost.
      </P>
      <H3>How much money could you lose to consignment fees?</H3>
      <P>Consider a used saddle selling for {usd(3000)}.</P>
      <div className="overflow-x-auto my-6">
        <table className="w-full text-[15.5px] border-collapse">
          <thead>
            <tr className="border-b-2 border-saddle-line text-left text-saddle-ink">
              <th className="py-2.5 pr-4 font-semibold">Selling method</th>
              <th className="py-2.5 pr-4 font-semibold text-right">Selling fee</th>
              <th className="py-2.5 font-semibold text-right">Seller receives</th>
            </tr>
          </thead>
          <tbody className="text-saddle-body">
            {[
              [`SaddleUp beta marketplace (${SELLER_FEE_PERCENT}%)`, fee(3000)],
              ['Consignment at 15%', 450],
              ['Consignment at 30%', 900]
            ].map(([label, f]) => (
              <tr key={label} className="border-b border-saddle-line">
                <td className="py-2.5 pr-4">{label}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{usd(f as number)}</td>
                <td className="py-2.5 text-right tabular-nums">{usd(3000 - (f as number))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm italic text-saddle-muted mt-2">
          Illustrative comparison excluding shipping, taxes, and other potential charges.
        </p>
      </div>
      <P>
        On a {usd(3000)} sale, the difference between a {SELLER_FEE_PERCENT}% marketplace fee and a 30% consignment
        commission is <strong>{usd(900 - fee(3000))}</strong>. That&apos;s money that could go toward your next saddle,
        a professional saddle fitting, or other expenses associated with owning a horse.
      </P>

      <H2 id="local">5. Local tack shops and equestrian communities</H2>
      <P>
        Your local tack shop, trainer, barn, or equestrian association may also help connect you with potential buyers.
        Selling locally has a significant advantage: prospective buyers may be able to examine the saddle in person.
        Some local tack shops offer consignment programs, while others maintain bulletin boards or informal networks of
        interested riders.
      </P>
      <P>
        The primary limitation is reach. A saddle that doesn&apos;t fit anyone in your immediate community may be
        exactly what a rider several states away is searching for. That&apos;s why online exposure can be valuable,
        particularly when selling specialized saddle brands, sizes, or models.
      </P>

      <H2 id="get-the-most">How to get the most money for your used saddle</H2>
      <P>Regardless of where you sell, a few steps can make your listing more appealing to potential buyers.</P>
      <H3>1. Research your saddle&apos;s value</H3>
      <P>Start by identifying the exact:</P>
      <UL>
        <li>Brand and model</li>
        <li>Seat size</li>
        <li>Tree width or manufacturer&apos;s fitting designation</li>
        <li>Year of manufacture, if known</li>
        <li>Flap length and position, where applicable</li>
        <li>Leather type</li>
        <li>Overall condition</li>
        <li>Repairs or alterations</li>
      </UL>
      <P>
        Research comparable saddles <A href="/saddles">currently for sale</A> and, where available, completed
        transactions. Remember that asking prices don&apos;t necessarily reflect what buyers are actually paying.
      </P>
      <H3>2. Photograph the entire saddle</H3>
      <P>High-quality photographs can make a substantial difference in buyer confidence. Include:</P>
      <UL>
        <li>Full side views from both sides</li>
        <li>Front and rear views</li>
        <li>Seat and pommel</li>
        <li>Underside panels</li>
        <li>Flaps and billets</li>
        <li>Manufacturer&apos;s stamp or serial number</li>
        <li>Any visible wear, scratches, or repairs</li>
      </UL>
      <P>Photographs should accurately represent the saddle&apos;s condition.</P>
      <H3>3. Include the serial number</H3>
      <P>
        Many English saddle manufacturers stamp identifying information beneath the flap. Depending on the brand, this
        may help establish the saddle&apos;s model, size, year, or other specifications. A clear photograph of the stamp
        can help prospective buyers evaluate the listing. If you&apos;re unsure what the numbers mean, contact the
        manufacturer or an authorized representative.
      </P>
      <H3>4. Be transparent about condition</H3>
      <P>
        Buyers appreciate accurate descriptions. Disclose any repairs, unusual wear, replaced billets, adjustments to the
        flocking, or known concerns about the tree. For high-value saddles, consider obtaining an inspection from a
        qualified saddle professional.
      </P>
      <H3>5. Price competitively</H3>
      <P>
        An overpriced saddle may remain unsold for months. If you aren&apos;t receiving meaningful inquiries, reassess
        the listing photographs, description, and price. When evaluating an offer, calculate your actual payout after
        selling fees and any shipping expenses.
      </P>
      <H3>6. Make shipping arrangements clear</H3>
      <P>Before listing, determine:</P>
      <UL>
        <li>Whether shipping is included in your asking price.</li>
        <li>Who pays for shipping.</li>
        <li>Whether the shipment will be insured.</li>
        <li>How the saddle will be packaged.</li>
        <li>What happens if the saddle is damaged in transit.</li>
      </UL>
      <P>Use a sturdy box, protect the saddle&apos;s structure, and obtain tracking information.</P>

      <H2 id="safety">Is it safe to sell a used saddle online?</H2>
      <P>
        Selling a saddle online can be a practical way to reach buyers beyond your local area, provided you take
        reasonable precautions. A few important practices include:
      </P>
      <UL>
        <li>Keep transaction communications documented.</li>
        <li>Review the marketplace&apos;s payment protections and seller requirements.</li>
        <li>Never share sensitive financial information directly with unknown buyers.</li>
        <li>Confirm the payment status through the actual payment platform.</li>
        <li>Photograph the saddle and packaging before shipment.</li>
        <li>Use tracked, appropriately insured shipping.</li>
        <li>Understand the return and dispute policies before completing a sale.</li>
      </UL>
      <P>
        For buyers, arranging an independent saddle inspection or professional fitting can be particularly important. A
        saddle that appears to be in excellent condition may still be unsuitable for a particular horse.
      </P>
    </>
  );
}

function Conclusion() {
  return (
    <>
      <H2 id="bottom-line">The bottom line: where should you sell your used saddle?</H2>
      <P>
        The best selling option depends on your priorities. Facebook groups can work well for local connections. eBay
        offers broad marketplace exposure. Consignment shops provide additional services for sellers who prefer a more
        hands-off experience. For riders who want a specialized platform with low selling fees, SaddleUp offers another
        option.
      </P>
      <P>
        Created by <A href="/about">an equestrian who experienced the frustration</A> of buying, fitting, and reselling
        expensive saddles, SaddleUp was designed to make the process easier and more economical.
      </P>
      <P>
        Whether you&apos;re selling a Devoucoux, CWD, Antares, Pessoa, or another quality saddle, your equipment deserves
        the opportunity to find its next rider.
      </P>
      <Callout>
        <strong>Ready to make room in your tack room?</strong> List your used saddle on SaddleUp today.
      </Callout>
      <CTA href={SELL}>List your saddle →</CTA>
    </>
  );
}

const guide: Guide = {
  slug: 'where-to-sell-used-saddle-online',
  title: 'Where to Sell a Used Saddle Online in 2026: The Complete Guide',
  metaTitle: 'Where to Sell a Used Saddle Online in 2026 | Best Options Compared',
  description:
    'Wondering where to sell your used saddle? Compare Facebook Marketplace, eBay, saddle consignment shops, and online marketplaces to find the best option.',
  summary: `Compare Facebook, eBay, consignment shops and SaddleUp on fees and effort. On a ${usd(3000)} saddle, a ${SELLER_FEE_PERCENT}% marketplace fee leaves you ${usd(3000 - fee(3000))}, versus ${usd(2100)} at a 30% consignment shop.`,
  published: '2026-11-08',
  updated: '2026-11-08',
  readMinutes: 10,
  faqs,
  sources: [
    ['eBay — Selling Fees', 'https://www.ebay.com/help/selling/fees-credits-invoices/fee-tables?id=4822'],
    ['Midwest Saddle Company — Sell Your Saddle', 'https://midwestsaddlecompany.com/pages/sell'],
    ['Saddle Gallery — Consign Your Saddle', 'https://saddlegallery.com/pages/consign-your-saddle'],
    [
      'Utah State University Extension — Inspecting and Buying a New or Used Saddle',
      'https://extension.usu.edu/equine/research/inspecting-and-buying-a-new-or-used-saddle'
    ],
    ['British Horse Society — Tack Affordability', 'https://www.bhs.org.uk/horse-care-and-welfare/features/tack-affordability/']
  ],
  Body,
  Conclusion
};

export default guide;
