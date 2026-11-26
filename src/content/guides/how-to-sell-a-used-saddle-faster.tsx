import { SELLER_FEE_CAP_DOLLARS, SELLER_FEE_PERCENT } from '@/lib/fees';
import { A, Callout, CTA, H2, H3, OL, P, UL } from '@/components/guides/Prose';
import type { Guide } from './types';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
/** SaddleUp's fee on a sale, using the same rule as checkout (percent, capped). */
const fee = (price: number) => Math.min(Math.round((price * SELLER_FEE_PERCENT) / 100), SELLER_FEE_CAP_DOLLARS);

const SELL = '/dashboard';

const faqs: Guide['faqs'] = [
  {
    q: 'How can I sell my used saddle faster?',
    a: 'Start by confirming its market price, improving photographs, identifying the exact model and specifications, and publishing a detailed listing where interested riders can find it. Clear payment and trial terms can also help buyers feel more comfortable proceeding.'
  },
  {
    q: 'Why am I getting views on my saddle listing but no offers?',
    a: "Potential buyers may be comparing prices, finding missing specifications, or deciding that the saddle isn't suitable for their horse. Review your photographs, measurements, and price before making changes."
  },
  {
    q: 'Is Facebook Marketplace a good place to sell a saddle?',
    a: 'Facebook can connect sellers with local riders and equestrian communities. A dedicated saddle marketplace can provide additional exposure to people searching for specific brands, models, and sizes.'
  },
  {
    q: 'Should I pay for saddle consignment?',
    a: 'Consignment can be worthwhile if you value professional photography, storage, inspections, sales assistance, or having someone else manage the transaction. Compare those benefits with the commission and your expected net proceeds.'
  },
  {
    q: 'Should I have my saddle inspected before selling it?',
    a: "A professional inspection can help establish the saddle's condition and identify concerns that aren't obvious from photographs. It is particularly valuable when the saddle has a history of repairs, unusual wear, or suspected structural problems."
  }
];

/** "What to do" lead-in used at the end of most sections. */
function Todo({ children }: { children: React.ReactNode }) {
  return (
    <P>
      <strong>What to do:</strong> {children}
    </P>
  );
}

const SIGNALS: [happening: string, meaning: string, tryThis: string][] = [
  ['Very few people view the listing', 'Limited exposure or poor search visibility', "Improve the title and where it's advertised"],
  ['Plenty of views, no messages', 'Price, photos, or specifications may be discouraging buyers', 'Compare prices and improve the listing'],
  ['Lots of questions about dimensions', 'Buyers lack essential information', 'Add measurements and stamp photographs'],
  ['Buyers ask for more photos, then disappear', 'They may discover a fit or condition concern', 'Provide a more complete photo set upfront'],
  ['Several trials but no sale', 'Fit may be the main obstacle', 'Verify specifications and review buyer feedback'],
  ['Offers consistently below asking price', 'The market may value the saddle differently', 'Reassess comparable sales and net proceeds']
];

function Body() {
  return (
    <>
      <P>There&apos;s a particular kind of frustration that comes with trying to sell a good saddle.</P>
      <P>
        You&apos;ve spent thousands of dollars on it. You&apos;ve cared for the leather, stored it properly, and perhaps
        had it fitted professionally. It&apos;s a beautiful saddle, made by a respected manufacturer.
      </P>
      <P>And now it&apos;s sitting in your tack room.</P>
      <P>
        You post it on Facebook. Someone asks if it&apos;s available. Another person wants seventeen additional
        photographs. Someone promises to send payment on Friday and disappears.
      </P>
      <P>Eventually, you start wondering whether you&apos;ve priced it too high.</P>
      <P>Maybe. But price is only one reason a saddle doesn&apos;t sell.</P>
      <P>
        <strong>
          The real challenge is that saddle buyers aren&apos;t shopping for a brand. They&apos;re shopping for a very
          specific combination of fit, condition, and price.
        </strong>
      </P>
      <P>
        A rider might love Devoucoux saddles but need an 18-inch seat, a forward flap, and panels that suit a particular
        horse. Your 17.5-inch Devoucoux could be immaculate and competitively priced, yet entirely wrong for that buyer.
      </P>
      <P>Understanding how riders shop for used saddles is the key to selling yours.</P>
      <P>Here are ten things worth knowing before you lower your price again.</P>

      <H2 id="comparables">1. Your saddle isn&apos;t competing with every other saddle of the same brand</H2>
      <P>Imagine you&apos;re selling a five-year-old Antares jumping saddle.</P>
      <P>You find another Antares listed for $3,800 and assume yours should be worth about the same.</P>
      <P>
        But what if that saddle has an 18-inch seat and forward flaps, while yours has a 17-inch seat and standard flaps?
      </P>
      <P>Those differences matter enormously to the person buying it.</P>
      <P>
        A tall rider who needs a longer, more forward flap may have no interest in your saddle, regardless of price.
      </P>
      <P>
        <strong>A useful comparable needs to match more than the brand.</strong>
      </P>
      <P>Ideally, compare:</P>
      <UL>
        <li>The same model or a closely related model</li>
        <li>Similar manufacturing years</li>
        <li>The same seat size</li>
        <li>Similar flap dimensions and position</li>
        <li>Comparable tree and panel configurations</li>
        <li>Similar condition</li>
      </UL>
      <P>This explains why two saddles from the same manufacturer can sell for very different amounts.</P>
      <P>It also explains why a saddle that seems attractively priced may receive surprisingly little attention.</P>
      <Todo>
        Find three to five genuinely comparable saddles. If you can&apos;t find an exact match, note the differences rather
        than assuming every saddle from that brand belongs in the same price range.
      </Todo>

      <H2 id="tree-width">2. A medium tree doesn&apos;t tell buyers as much as you think</H2>
      <P>Here&apos;s something that surprises many riders: there is no universal medium tree.</P>
      <P>
        A medium tree in one brand doesn&apos;t necessarily have the same dimensions or shape as a medium tree in another.
      </P>
      <P>Even within a manufacturer, different models and tree designs can fit differently.</P>
      <P>
        Tree width is only part of the equation. Tree-point angle, panel shape, curvature, and the horse&apos;s back all
        influence fit.
      </P>
      <P>
        For example, a seller might describe a Stübben saddle as a medium because its tree is stamped with a particular
        centimeter measurement. However, Stübben&apos;s width specifications are manufacturer-specific, and translating a
        centimeter stamp into a generic narrow, medium, or wide label can introduce errors.
      </P>
      <P>The manufacturer&apos;s original designation is often more useful than an interpretation.</P>
      <Todo>
        Include the actual stamped tree measurement or manufacturer designation. If you know the tree or panel model,
        include that too.
      </Todo>
      <P>
        And remember, a saddle fitter should determine whether the saddle is appropriate for the buyer&apos;s horse.
      </P>
      <P>
        Your job as a seller is to provide accurate information that helps the buyer decide whether it&apos;s worth
        investigating.
      </P>

      <H2 id="stamp">3. The manufacturer&apos;s stamp may be your most valuable photograph</H2>
      <P>When buyers are evaluating a premium used saddle, one of their first questions is often:</P>
      <P>&ldquo;Can you send me a picture of the stamp?&rdquo;</P>
      <P>There&apos;s a good reason for that.</P>
      <P>
        Depending on the manufacturer, the serial number or stamp can help identify the manufacturing year, model, seat
        size, flap configuration, or other specifications.
      </P>
      <P>
        This is particularly useful with brands such as CWD, Devoucoux, Antares, and Stübben, where seemingly similar
        saddles may have different configurations.
      </P>
      <P>
        For example, a buyer searching for a particular CWD model may want to confirm its exact flap specifications before
        considering a trial.
      </P>
      <P>A clear stamp photograph can help them ask the manufacturer the right questions.</P>
      <Todo>
        Photograph the complete stamp in natural light, making sure every letter and number is legible.
      </Todo>
      <P>If you cannot interpret it, don&apos;t guess. Contact the manufacturer or authorized representative.</P>
      <P>
        One important distinction: a serial number can help identify a saddle. It does not independently prove that the
        saddle is structurally sound or suitable for a particular horse.
      </P>

      <H2 id="photos">4. Buyers are looking at your photos differently than you are</H2>
      <P>You might photograph your saddle to show how beautiful it is.</P>
      <P>A serious buyer is examining those same photos for evidence.</P>
      <P>
        They&apos;re looking at the billets, stitching, panels, seat, and overall shape. They&apos;re trying to identify
        wear, understand the construction, and decide whether the saddle deserves further consideration.
      </P>
      <P>A photograph taken at an attractive angle can actually make this harder.</P>
      <P>
        For example, a side photograph taken from above may make it difficult to judge flap proportions. A close-up of the
        seat might hide the overall configuration.
      </P>
      <H3>The five most useful photographs to take first</H3>
      <OL>
        <li>A complete side view, photographed square-on.</li>
        <li>The underside, showing both panels clearly.</li>
        <li>A view from the front, showing the pommel and panel arrangement.</li>
        <li>The seat and cantle from above.</li>
        <li>A clear close-up of the manufacturer&apos;s stamp.</li>
      </OL>
      <P>Then add close-ups of the billets, stitching, and any areas showing wear.</P>
      <P>Place the saddle on a stable saddle stand, use natural light, and avoid filters.</P>
      <P>Photograph any defects clearly.</P>
      <P>
        A well-photographed scratch is far less alarming than a buyer discovering an undisclosed scratch after delivery.
      </P>

      <H2 id="condition">5. &ldquo;Excellent condition&rdquo; isn&apos;t particularly useful</H2>
      <P>Almost every seller describes their saddle as being in excellent condition.</P>
      <P>But that phrase means different things to different people.</P>
      <P>
        A saddle may have beautifully maintained leather and still require new billets. Another may show cosmetic wear
        while having recently been inspected and serviced.
      </P>
      <P>Buyers benefit from specifics.</P>
      <P>Instead of writing:</P>
      <Callout>&ldquo;Excellent condition. Very well cared for.&rdquo;</Callout>
      <P>Try:</P>
      <Callout>
        &ldquo;Leather is soft and supple with normal wear on the flaps. No known structural issues. Billets replaced in
        2024. Panels professionally inspected in 2025.&rdquo;
      </Callout>
      <P>Only make claims you can support, and retain records of professional work when possible.</P>
      <P>Also, be careful with statements such as &ldquo;tree is sound.&rdquo;</P>
      <P>
        Structural problems aren&apos;t always visible in photographs. If you have reason to suspect a problem, have the
        saddle examined by a qualified professional before selling it for riding use.
      </P>
      <P>
        Specific information makes your listing more credible and gives buyers a better basis for deciding whether to
        inquire.
      </P>

      <H2 id="price">6. Your asking price might be reasonable, but your evidence is weak</H2>
      <P>Let&apos;s say you paid $5,000 for a saddle three years ago and have listed it for $3,500.</P>
      <P>That sounds reasonable. You&apos;re already accepting a substantial loss.</P>
      <P>But the original purchase price isn&apos;t what determines resale value.</P>
      <P>A buyer is asking a different question:</P>
      <P>&ldquo;What else can I buy for $3,500 today?&rdquo;</P>
      <P>
        Perhaps a similar saddle is available from a retailer that offers a professional inspection and a trial. Perhaps
        another private seller has an equivalent model for less.
      </P>
      <P>The buyer is comparing the entire transaction, including price, condition, risk, and convenience.</P>
      <P>There&apos;s another trap here.</P>
      <P>
        <strong>An asking price is not a sale price.</strong>
      </P>
      <P>
        If you see five saddles advertised for $3,500, that tells you what five sellers hope to receive. It doesn&apos;t
        tell you what buyers are paying.
      </P>
      <P>When available, completed sales are more useful.</P>
      <P>
        If completed-sale information isn&apos;t accessible, monitor comparable listings over time. Notice which
        disappear, which are reduced, and which remain available. A disappearing listing is not proof of a sale, but the
        pattern may help you assess the market.
      </P>
      <H3>A better way to think about price</H3>
      <P>Separate three numbers:</P>
      <UL>
        <li>
          <strong>Your asking price:</strong> What you advertise.
        </li>
        <li>
          <strong>Your acceptable price:</strong> The lowest amount you&apos;re comfortable agreeing to.
        </li>
        <li>
          <strong>Your net proceeds:</strong> What remains after selling fees and expenses.
        </li>
      </UL>
      <P>
        For example, a saddle selling for {usd(3000)} through a marketplace charging a {SELLER_FEE_PERCENT}% total fee
        leaves the seller with {usd(3000 - fee(3000))} before any additional expenses.
      </P>
      <P>That same {usd(3000)} sale with a 30% commission leaves {usd(2100)}.</P>
      <P>The difference is {usd(3000 - fee(3000) - 2100)}.</P>
      <P>
        The commission comparison doesn&apos;t tell the whole story—some services include photography, storage,
        inspections, and buyer support. But it does mean you should evaluate your final payout before deciding how far to
        reduce your asking price.
      </P>

      <H2 id="audience">7. You may be advertising to plenty of riders, but very few potential buyers</H2>
      <P>Facebook equestrian groups can be wonderful communities.</P>
      <P>They&apos;re also crowded.</P>
      <P>
        A saddle listing competes with horses for sale, training questions, show announcements, and dozens of other posts.
      </P>
      <P>
        Even within a tack-specific group, the number of riders who need your exact saddle configuration at that moment
        may be small.
      </P>
      <P>
        Think about someone looking for an 18-inch Devoucoux Chiberta with a particular flap and tree configuration.
      </P>
      <P>
        They may search Google for that exact combination. They may browse dedicated saddle marketplaces. They may look
        through several retailers before considering Facebook.
      </P>
      <P>
        The more specialized the item, the more important it becomes to make it findable by the people already searching
        for it.
      </P>
      <Todo>
        Use a detailed, searchable listing with the brand, model, measurements, and condition clearly identified.
      </Todo>
      <P>Publish it somewhere buyers can discover it beyond the lifespan of a social media post.</P>
      <P>
        That&apos;s one of the reasons we built <A href="/">SaddleUp</A>: to give used close-contact saddles a dedicated
        marketplace where riders can search by the specifications that matter.
      </P>
      <P>
        Public saddle listings can also be eligible for discovery through Google and AI-powered search, although
        visibility depends on indexing, relevance, and other factors.
      </P>
      <P>You can continue sharing your listing on Facebook while giving buyers a more detailed destination to visit.</P>

      <H2 id="risk">8. Buyers are calculating the risk of getting it wrong</H2>
      <P>
        Here&apos;s an important distinction between selling a saddle and selling most other secondhand equipment.
      </P>
      <P>
        A buyer can examine photographs, confirm the model, and love the price—and the saddle can still be wrong for their
        horse.
      </P>
      <P>That&apos;s a considerable risk when thousands of dollars are involved.</P>
      <P>
        The British Horse Society recommends professional fitting when buying secondhand saddles, and experienced buyers
        often want the opportunity to have a qualified fitter assess a saddle before committing.
      </P>
      <P>This is why transaction terms matter.</P>
      <P>Before purchasing, a buyer wants to know:</P>
      <UL>
        <li>Can I inspect or trial the saddle?</li>
        <li>How long do I have?</li>
        <li>Who pays shipping if it doesn&apos;t work?</li>
        <li>What happens if the condition differs from the description?</li>
        <li>When does the seller receive payment?</li>
      </UL>
      <P>A listing that makes these answers easy to find may remove an important obstacle to purchase.</P>
      <Todo>
        Choose a selling method with clear terms and make sure both parties understand them before money changes hands.
      </Todo>
      <P>
        For private transactions, use suitable payment protections and avoid arrangements that leave either party exposed
        to unnecessary risk.
      </P>

      <H2 id="diagnose">9. You might be lowering the price when the real problem is something else</H2>
      <P>Before dropping your asking price by $500, look at what potential buyers are actually doing.</P>
      <P>Different patterns suggest different problems.</P>
      {/* Phones: one card per row, so nothing is hidden off the side. */}
      <ul className="sm:hidden my-6 space-y-3">
        {SIGNALS.map(([happening, meaning, tryThis]) => (
          <li key={happening} className="border border-saddle-line rounded bg-saddle-paper px-4 py-3 text-[15px] leading-[1.55] text-saddle-body">
            <p className="font-semibold text-saddle-ink">{happening}</p>
            <p className="mt-1"><span className="text-saddle-muted">May mean:</span> {meaning}</p>
            <p className="mt-1"><span className="text-saddle-muted">Try:</span> {tryThis}</p>
          </li>
        ))}
      </ul>
      <div className="hidden sm:block my-6">
        <table className="w-full text-left text-[15px] leading-[1.55] text-saddle-body border-collapse">
          <thead>
            <tr className="border-b-2 border-saddle-line text-saddle-ink">
              <th scope="col" className="py-2 pr-4 font-semibold">What&apos;s happening</th>
              <th scope="col" className="py-2 pr-4 font-semibold">What it may mean</th>
              <th scope="col" className="py-2 font-semibold">What to try</th>
            </tr>
          </thead>
          <tbody>
            {SIGNALS.map(([happening, meaning, tryThis]) => (
              <tr key={happening} className="border-b border-saddle-line align-top">
                <td className="py-2.5 pr-4 text-saddle-ink">{happening}</td>
                <td className="py-2.5 pr-4">{meaning}</td>
                <td className="py-2.5">{tryThis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>These are clues, not definitive diagnoses.</P>
      <P>
        But they help prevent a common mistake: responding to every slow sale with another price reduction.
      </P>
      <P>Sometimes the highest-value change you can make costs nothing.</P>

      <H2 id="be-specific">10. The fastest way to sell may be to stop trying to appeal to everyone</H2>
      <P>Here&apos;s the final lesson.</P>
      <P>A used saddle doesn&apos;t need thousands of interested people.</P>
      <P>
        It needs one person whose horse, riding style, and budget make that particular saddle a realistic option.
      </P>
      <P>Consider two descriptions.</P>
      <P>
        <strong>Listing A:</strong>
      </P>
      <Callout>&ldquo;Beautiful brown jumping saddle. 17.5 inches. Great condition. $2,500.&rdquo;</Callout>
      <P>
        <strong>Listing B:</strong>
      </P>
      <Callout>
        &ldquo;2021 Antares Skylla jumping saddle, 17.5-inch seat. Manufacturer&apos;s stamp photographed. Standard flap
        configuration, with detailed flap measurements provided. Normal cosmetic wear, no known structural damage.
        Additional panel and billet photographs included. $2,500.&rdquo;
      </Callout>
      <P>The second listing helps a buyer decide whether to investigate further.</P>
      <P>It also makes the saddle easier to find through specific searches.</P>
      <P>You don&apos;t need to make your saddle sound perfect.</P>
      <P>You need to make it easy for the right rider to recognize that it might be right for them.</P>

      <H2 id="before-you-lower">Before you lower your asking price, try this</H2>
      <P>
        If your saddle has been listed for several weeks without meaningful interest, give yourself thirty minutes to
        improve the advertisement.
      </P>
      <P>
        First, look at three genuinely comparable saddles. Focus on matching the model, age, seat size, and flap
        configuration as closely as possible.
      </P>
      <P>Next, take fresh photographs. Include the manufacturer&apos;s stamp, panels, billets, and any wear.</P>
      <P>Then rewrite your title so that it identifies the exact saddle.</P>
      <P>
        Replace vague claims about condition with useful details. Verify the specifications you can, and identify
        anything you&apos;re unsure about.
      </P>
      <P>Finally, give your listing an opportunity to reach riders actively searching for that type of saddle.</P>
      <P>
        These changes won&apos;t guarantee a sale. They can help potential buyers make a more informed decision and may
        save you from reducing your price unnecessarily.
      </P>
    </>
  );
}

function Conclusion() {
  return (
    <>
      <H2 id="next-owner">Your saddle may be exactly what someone else is looking for</H2>
      <P>
        At SaddleUp, we know how frustrating it can be to have a beautiful saddle sitting unused while you&apos;re trying
        to find its next owner.
      </P>
      <P>We created SaddleUp to make buying and selling used close-contact saddles more straightforward.</P>
      <P>
        You can upload photographs of your saddle, including its manufacturer&apos;s stamp, to help identify it, explore an
        estimated resale value, and prepare a listing.
      </P>
      <P>
        It&apos;s free to list during our beta period, with a {SELLER_FEE_PERCENT}% total selling fee if your saddle sells,
        including payment processing.
      </P>
      <CTA href={SELL}>See what your saddle is worth and list it on SaddleUp →</CTA>
      <P>Because somewhere, another rider may be searching for precisely the saddle you no longer need.</P>
    </>
  );
}

const guide: Guide = {
  slug: 'how-to-sell-a-used-saddle-faster',
  title: "Why Isn't My Saddle Selling? 10 Things Experienced Saddle Sellers Know",
  metaTitle: 'How to Sell a Used Saddle Faster: 10 Things That Actually Matter',
  description:
    "Your used saddle isn't selling? Learn how saddle fit, pricing, manufacturer stamps, photographs, and buyer confidence affect resale—and what to change.",
  summary:
    'Buyers shop for an exact combination of fit, condition and price, not a brand. Before cutting your price, check your comparables, show the stamp and real measurements, photograph what buyers look for, and make the listing easy to find.',
  published: '2026-11-26',
  updated: '2026-11-26',
  readMinutes: 12,
  faqs,
  sources: [],
  Body,
  Conclusion
};

export default guide;
