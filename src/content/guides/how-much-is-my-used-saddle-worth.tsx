import { SELLER_FEE_CAP_DOLLARS, SELLER_FEE_PERCENT } from '@/lib/fees';
import { A, Callout, CTA, H2, H3, OL, P, UL } from '@/components/guides/Prose';
import type { Guide } from './types';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
/** SaddleUp's fee on a sale, using the same rule as checkout (percent, capped). */
const fee = (price: number) => Math.min(Math.round((price * SELLER_FEE_PERCENT) / 100), SELLER_FEE_CAP_DOLLARS);

const SELL = '/dashboard';
const EX = 3000;

const faqs: Guide['faqs'] = [
  {
    q: 'How much should I sell my used saddle for?',
    a: 'Start by researching comparable saddles of the same brand, model, age, size, and condition. Use completed sale prices whenever possible, then adjust your asking price to reflect your saddle’s specifications and current demand.'
  },
  {
    q: 'How much does a used Devoucoux saddle cost?',
    a: 'Used Devoucoux prices vary widely depending on model, age, condition, and configuration. Compare your specific model with current listings and recent completed sales to establish a realistic range.'
  },
  {
    q: 'How much is a used CWD saddle worth?',
    a: 'A CWD saddle’s resale value depends on its model, manufacturing year, seat size, flap configuration, condition, and buyer demand. There is no single resale price that accurately represents every CWD saddle.'
  },
  {
    q: 'Do English saddles depreciate?',
    a: 'Most saddles experience some depreciation with age and use. The rate varies substantially based on brand, model, condition, construction, and market demand.'
  },
  {
    q: 'Is a saddle worth more if it has been professionally maintained?',
    a: 'Professional maintenance can help preserve a saddle’s condition and buyer appeal. Keep documentation of significant repairs, inspections, or adjustments when available.'
  },
  {
    q: 'How can I find out what year my saddle was made?',
    a: 'Check the manufacturer’s stamp or serial number, typically located beneath a flap. Contact the manufacturer or an authorized representative if the date cannot be confidently identified.'
  },
  {
    q: 'Where can I sell my used saddle?',
    a: 'Options include local tack shops, equestrian Facebook groups, eBay, consignment businesses, and specialized marketplaces such as SaddleUp. Compare fees, buyer reach, convenience, and transaction policies before selecting a platform.'
  }
];

const CONDITIONS: [string, string][] = [
  ['Excellent', 'Minimal visible wear, clean leather, well-maintained, no known structural concerns'],
  ['Very good', 'Normal signs of use, sound leather and stitching, no significant damage'],
  ['Good', 'Noticeable cosmetic wear, fully functional, may benefit from routine maintenance'],
  ['Fair', 'Significant wear or repairs needed; value depends on professional assessment']
];

function Table({ head, rows, note }: { head: string[]; rows: (string | number)[][]; note?: string }) {
  return (
    <div className="overflow-x-auto my-6">
      <table className="w-full text-[15.5px] border-collapse">
        <thead>
          <tr className="border-b-2 border-saddle-line text-left text-saddle-ink">
            {head.map((h, i) => (
              <th key={h} className={`py-2.5 pr-4 font-semibold ${i > 0 && typeof rows[0][i] === 'number' ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-saddle-body">
          {rows.map((r) => (
            <tr key={String(r[0])} className="border-b border-saddle-line align-top">
              {r.map((c, i) =>
                typeof c === 'number' ? (
                  <td key={i} className="py-2.5 pr-4 text-right tabular-nums">{usd(c)}</td>
                ) : (
                  <td key={i} className={`py-2.5 pr-4 ${i === 0 ? 'font-medium text-saddle-ink whitespace-nowrap' : ''}`}>{c}</td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="text-sm italic text-saddle-muted mt-2">{note}</p>}
    </div>
  );
}

function Body() {
  return (
    <>
      <P>
        If you&apos;ve ever tried to sell a used saddle, you&apos;ve probably asked yourself one frustrating question:{' '}
        <strong>how much is my saddle actually worth?</strong>
      </P>
      <P>
        You may have spent $5,000 or more on a beautiful English saddle, carefully maintained it, and ridden in it for
        only a few seasons. Now it no longer fits your horse, and you&apos;re discovering that figuring out its resale
        value isn&apos;t as straightforward as you expected.
      </P>
      <P>
        Should you ask $3,500? Would $2,500 sell faster? Is a consignment shop&apos;s offer a fair reflection of its
        value? The answer depends on several factors, including the brand, age, condition, model, fit specifications, and
        current buyer demand.
      </P>
      <P>
        This guide will help you understand how used English saddles are valued, how to research comparable sales, and
        how to price your saddle competitively without leaving unnecessary money on the table.
      </P>

      <H2 id="what-is-it-worth">How much is a used English saddle worth?</H2>
      <P>
        A used English saddle&apos;s value depends on its current resale market, rather than what the original owner paid
        for it. As a starting point, sellers can research comparable saddles and consider the following factors:
      </P>
      <UL>
        <li><strong>Brand:</strong> Established premium brands may attract buyers willing to pay more for particular models.</li>
        <li><strong>Age:</strong> Newer saddles may command higher prices, depending on condition and demand.</li>
        <li><strong>Condition:</strong> Leather wear, stitching, billet condition, and structural integrity affect value.</li>
        <li><strong>Model:</strong> Certain models remain desirable because of their design, reputation, or suitability for a riding discipline.</li>
        <li><strong>Fit specifications:</strong> Seat size, tree width, flap configuration, and panel shape can influence buyer interest.</li>
        <li><strong>Adjustability:</strong> Some buyers specifically seek wool-flocked or adjustable saddle designs.</li>
        <li><strong>Market demand:</strong> A saddle&apos;s value ultimately depends on what a buyer is prepared to pay.</li>
      </UL>
      <P>
        There is no universal depreciation percentage that accurately values every saddle. For example, a well-maintained
        older saddle in a desirable configuration may sell for more than a newer saddle with unusual specifications or
        significant wear.
      </P>
      <P>The most reliable approach is to compare your saddle with similar examples that have actually sold.</P>

      <H2 id="five-steps">How to determine your saddle&apos;s resale value in five steps</H2>
      <H3>Step 1: Identify the exact brand and model</H3>
      <P>Start by confirming the manufacturer and model. Well-known English saddle brands include:</P>
      <UL>
        <li>Devoucoux</li>
        <li>CWD</li>
        <li>Antares</li>
        <li>Pessoa</li>
        <li>Butet</li>
        <li>Voltaire Design</li>
        <li>Prestige</li>
        <li>Stubben</li>
        <li>Custom Saddlery</li>
        <li>County Saddlery</li>
        <li>Bruno Delgrange</li>
      </UL>
      <P>
        Within each brand, individual models can have different resale values. For example, two Devoucoux saddles of the
        same age may command different prices because one is a jumping saddle with a particular flap configuration while
        the other is designed for a different purpose.
      </P>
      <P>The more accurately you identify your saddle, the easier it becomes to find meaningful comparisons.</P>

      <H3>Step 2: Find the serial number</H3>
      <P>
        Many English saddle manufacturers include identifying information stamped beneath the flap. Depending on the
        brand, the stamp may reveal:
      </P>
      <UL>
        <li>Year of manufacture</li>
        <li>Model</li>
        <li>Seat size</li>
        <li>Flap length or position</li>
        <li>Manufacturer-specific fitting information</li>
      </UL>
      <P>
        Serial-number formats vary by manufacturer and may change over time. If you cannot interpret your saddle&apos;s
        stamp, contact the manufacturer or an authorized dealer.
      </P>
      <Callout>
        <strong>Seller tip:</strong> Include a clear photograph of the manufacturer&apos;s stamp in your listing. Buyers
        frequently request this information when researching used saddles.
      </Callout>

      <H3>Step 3: Evaluate the saddle&apos;s condition</H3>
      <P>Condition plays a significant role in resale value. Consider the following categories:</P>
      <Table head={['Condition', 'Description']} rows={CONDITIONS} />
      <P>
        Saddles with suspected tree damage or other structural concerns should be evaluated by a qualified professional
        before being offered for riding use. Cosmetic imperfections may reduce a saddle&apos;s appeal, while structural
        problems can significantly affect its safety and value.
      </P>
      <P>Be transparent about any damage, repairs, replaced billets, or panel modifications.</P>

      <H3>Step 4: Research comparable saddles</H3>
      <P>
        One of the best ways to estimate your saddle&apos;s value is to examine{' '}
        <A href="/saddles">similar saddles currently listed for sale</A>. Search using specific combinations of:
      </P>
      <UL>
        <li>Brand</li>
        <li>Model</li>
        <li>Year</li>
        <li>Seat size</li>
        <li>Flap configuration</li>
        <li>Tree or fitting specifications</li>
        <li>Condition</li>
      </UL>
      <P>
        For example, searching for a &quot;2021 Devoucoux Chiberta 18-inch jumping saddle&quot; will generally produce
        more useful comparisons than searching for &quot;used Devoucoux saddle.&quot;
      </P>
      <P>
        Look at several sources, including specialized equestrian marketplaces, established saddle resellers, and
        completed eBay sales when available.
      </P>
      <Callout>
        <strong>Important:</strong> A saddle advertised for $3,500 has an asking price of $3,500. That doesn&apos;t
        establish what someone will ultimately pay. Completed sales provide stronger evidence of market value when the
        saddles are genuinely comparable.
      </Callout>

      <H3>Step 5: Calculate your actual payout</H3>
      <P>
        The selling price is only part of the equation. The amount you receive also depends on selling fees, shipping
        expenses, and other transaction costs. Consider a saddle that sells for {usd(EX)}.
      </P>
      <Table
        head={['Selling fee', 'Total fees', 'Seller receives']}
        rows={[5, 15, 20, 30, 40].map((pct) => {
          const f = Math.round((EX * pct) / 100);
          return [`${pct}%`, f, EX - f];
        })}
        note="Illustrative examples excluding shipping and additional charges."
      />
      <P>
        A lower selling fee can meaningfully increase the amount you retain. For example, <A href="/">SaddleUp</A>{' '}
        currently offers a {SELLER_FEE_PERCENT}% total selling fee during its beta period, including payment processing
        and capped at {usd(SELLER_FEE_CAP_DOLLARS)} per sale. That means a seller receiving {usd(EX)} for a saddle would
        retain approximately {usd(EX - fee(EX))} before any additional applicable expenses.
      </P>

      <H2 id="premium-brands">Do premium English saddles hold their value?</H2>
      <P>
        Premium English saddles can retain meaningful resale value when they are well maintained and remain desirable to
        buyers. However, brand reputation alone doesn&apos;t guarantee a particular resale price. Here are several brands
        frequently encountered in the used English saddle market.
      </P>
      <H3>Devoucoux saddles</H3>
      <P>
        Devoucoux produces premium French saddles used across several equestrian disciplines. When evaluating a used
        Devoucoux, buyers may consider the specific model, leather condition, flap configuration, panel design, and year
        of manufacture. Accurate photographs and manufacturer information can help sellers distinguish their saddles from
        other listings.
      </P>
      <H3>CWD saddles</H3>
      <P>
        CWD saddles are well established in the hunter/jumper market. Resale considerations include the model, seat size,
        flap specifications, age, and overall condition. Because saddles may have been produced with different
        configurations, sellers should verify the exact specifications before setting a price.
      </P>
      <H3>Antares saddles</H3>
      <P>
        Antares produces premium saddles for multiple disciplines. Buyers evaluating a used Antares may focus on model,
        seat size, flap design, panel configuration, and suitability for their horse. A clear description of these
        features can make a listing more useful.
      </P>
      <H3>Pessoa saddles</H3>
      <P>
        Pessoa is a recognizable name among English riders, particularly in jumping disciplines. Used Pessoa saddles vary
        in age, construction, model, and condition. Researching the exact model is essential because resale prices can
        differ substantially across the brand&apos;s product history.
      </P>
      <H3>Butet, Voltaire, Prestige, and other premium brands</H3>
      <P>
        Each manufacturer has its own model history, design characteristics, and buyer following. The key to an accurate
        valuation is identifying the specific saddle and comparing it with similar examples.
      </P>
      <Callout>
        <strong>The takeaway:</strong> A brand name provides a useful starting point. Model-specific market evidence
        determines a more realistic asking price.
      </Callout>

      <H2 id="age">Does saddle age affect resale value?</H2>
      <P>
        Generally, age matters because materials wear, designs evolve, and buyer preferences change. However, a
        saddle&apos;s age should always be considered alongside its condition.
      </P>
      <P>
        A ten-year-old saddle that has been meticulously maintained may remain highly desirable. Meanwhile, a relatively
        new saddle with significant leather damage or questionable structural integrity may be considerably less
        valuable.
      </P>
      <P>
        When preparing your listing, provide the manufacturing year if you can verify it. If you&apos;re unsure, say so
        rather than estimating. Buyers appreciate accurate information.
      </P>

      <H2 id="wool-flocking">Does wool flocking increase a saddle&apos;s resale value?</H2>
      <P>
        Some buyers specifically search for wool-flocked saddles because the panels can be adjusted by a qualified saddle
        fitter. Other buyers prefer the feel or design characteristics of foam panels. Neither construction automatically
        makes a saddle more valuable.
      </P>
      <P>
        What matters is whether the saddle&apos;s design suits the intended horse and rider, along with the model&apos;s
        condition and demand. If your saddle has wool flocking, foam panels, or a specialized adjustable system, include
        that information in your listing. If the panels have been modified, disclose those adjustments as well.
      </P>

      <H2 id="negotiation">Should you price your saddle higher to leave room for negotiation?</H2>
      <P>
        Many sellers add a little flexibility to their asking price to accommodate offers. That approach can work,
        provided the initial price remains competitive. If comparable saddles are selling near $2,500, advertising yours
        for $4,000 could discourage serious buyers.
      </P>
      <P>A more effective strategy is to establish a realistic market range and select an asking price based on:</P>
      <OL>
        <li>The saddle&apos;s condition.</li>
        <li>Comparable completed sales.</li>
        <li>How quickly you want to sell.</li>
        <li>Your minimum acceptable payout.</li>
        <li>The fees associated with your chosen marketplace.</li>
      </OL>
      <P>
        An accurately priced saddle with clear photographs and complete specifications gives buyers more confidence.
      </P>

      <H2 id="not-selling">Why isn&apos;t my used saddle selling?</H2>
      <P>
        If your saddle has been listed for several weeks without serious inquiries, examine the following possibilities.
      </P>
      <H3>Your asking price is too high</H3>
      <P>
        Compare your saddle against similar listings and recent sales. Pay attention to differences in age, condition,
        and specifications.
      </P>
      <H3>Your photographs don&apos;t show enough detail</H3>
      <P>
        Buyers often want to see the underside, billets, panels, seat, flap markings, and signs of wear. Poor photographs
        may cause otherwise interested buyers to keep searching.
      </P>
      <H3>Your listing lacks important specifications</H3>
      <P>
        A description such as &quot;Beautiful 17-inch jumping saddle&quot; leaves numerous unanswered questions. Add the
        brand, model, year, flap measurements, fitting information, condition, and any relevant modifications.
      </P>
      <H3>Your saddle isn&apos;t reaching the right audience</H3>
      <P>
        A specialized saddle may need exposure beyond your local barn or social media community. Listing on a searchable
        equestrian marketplace can help more potential buyers discover it.
      </P>
      <H3>Your saddle has unusual fit characteristics</H3>
      <P>
        Some configurations appeal to a smaller group of riders and horses. Selling these saddles may require more time,
        detailed specifications, and patience.
      </P>

      <H2 id="private-or-consignment">Should you sell your saddle privately or through consignment?</H2>
      <P>
        Both options have advantages. A consignment shop may photograph, advertise, store, and manage the sale for you.
        Depending on the service, it may also provide fitting assistance or handle trials. In return, the business
        receives a commission.
      </P>
      <P>
        Selling through an online marketplace allows you to manage your listing and retain more control over pricing. The
        important comparison is your expected net payout. For example, imagine two selling scenarios:
      </P>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        {[
          ['Scenario A: Consignment', 'Commission: 30%', EX - Math.round(EX * 0.3)],
          ['Scenario B: SaddleUp', `Beta selling fee: ${SELLER_FEE_PERCENT}%`, EX - fee(EX)]
        ].map(([title, feeLine, net]) => (
          <div key={title as string} className="rounded-[3px] border border-saddle-line bg-saddle-paper px-5 py-4 text-[16px] text-saddle-body">
            <div className="font-serif text-[19px] text-saddle-ink mb-2">{title}</div>
            <div>Sale price: {usd(EX)}</div>
            <div>{feeLine}</div>
            <div className="font-semibold text-saddle-ink mt-1">Seller receives: {usd(net as number)}</div>
          </div>
        ))}
      </div>
      <P>
        Both calculations exclude additional expenses. In this example, the marketplace seller retains{' '}
        <strong>{usd(Math.round(EX * 0.3) - fee(EX))} more</strong>.
      </P>
      <P>
        The value of consignment services depends on how much time and effort they save you and whether they help achieve
        a better selling price. For a full comparison of your options, see{' '}
        <A href="/guides/where-to-sell-used-saddle-online">where to sell a used saddle online</A>.
      </P>
    </>
  );
}

function Conclusion() {
  return (
    <>
      <H2 id="ready-to-sell">Ready to sell your used saddle?</H2>
      <P>
        Your saddle represents a meaningful investment. Whether you&apos;ve upgraded, changed horses, or discovered that
        the fit is no longer right, selling it can help fund your next purchase.
      </P>
      <P>
        The first step is understanding its market value. Take the time to identify your saddle, research comparable
        sales, photograph it accurately, and establish a realistic asking price. Then choose a selling platform that
        supports your goals.
      </P>
      <P>
        SaddleUp was <A href="/about">created by riders</A> who understand the frustration of trying to resell a quality
        saddle while preserving as much of its value as possible. With a simplified listing process, public search
        visibility, and a {SELLER_FEE_PERCENT}% total beta selling fee, SaddleUp gives saddle owners another way to reach
        potential buyers.
      </P>
      <Callout>
        <strong>Your saddle may be exactly what another rider is looking for.</strong>
      </Callout>
      <CTA href={SELL}>List your saddle on SaddleUp →</CTA>
    </>
  );
}

const guide: Guide = {
  slug: 'how-much-is-my-used-saddle-worth',
  title: 'How Much Is My Used Saddle Worth? A Complete Guide to Pricing English Saddles in 2026',
  metaTitle: 'How Much Is My Used Saddle Worth? | 2026 Pricing Guide',
  description:
    'Wondering what your used saddle is worth? Learn how to price Devoucoux, CWD, Antares, Pessoa, and other English saddles for resale.',
  summary:
    'A used saddle is worth what comparable saddles have actually sold for, not what you paid. Match the exact brand, model, year, seat size, flap and condition against completed sales, then work back from your payout after fees.',
  published: '2026-11-08',
  updated: '2026-11-08',
  readMinutes: 11,
  faqs,
  sources: [],
  note: 'Saddle values and resale demand vary. Numerical examples are illustrative and do not represent verified average resale prices. Fees are subject to change.',
  Body,
  Conclusion
};

export default guide;
