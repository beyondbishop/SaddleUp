import { SELLER_FEE_PERCENT } from '@/lib/fees';
import { A, Callout, CTA, H2, H3, OL, P, UL } from '@/components/guides/Prose';
import type { Guide } from './types';

const SELL = '/dashboard';

const faqs: Guide['faqs'] = [
  {
    q: 'Where is the size stamped on an English saddle?',
    a: 'Lift the flap and look on the underside of the skirt near the stirrup bar, on the panel, or on a small metal plate. Many brands stamp the seat size, tree width, flap code and a serial number there. Some put a nameplate on the back of the cantle.'
  },
  {
    q: 'How do I measure the seat size of an English saddle?',
    a: 'Measure in a straight line from the nailhead or screw on the side of the pommel to the center of the back edge of the cantle. Round to the nearest half inch. Most adult English saddles are between 16 and 18 inches.'
  },
  {
    q: 'How do I find the tree width if it isn’t stamped?',
    a: 'Measure straight across between the tips of the tree points, which are the stiff bars inside the front of the panels, and list that number in centimeters. Brands label widths differently, so the measurement is more useful to a buyer than a guessed label.'
  },
  {
    q: 'How do I measure a western saddle seat?',
    a: 'Measure from the back of the swell (the fork) to the top edge of the cantle where the seat meets the binding. Most adult western seats are between 14 and 17 inches.'
  },
  {
    q: 'Does a tree measurement in centimeters mean the same thing for every brand?',
    a: 'No. A 31 cm tree from one brand can fit differently from a 31 cm tree from another, because brands measure in slightly different places and shape their trees differently. Give buyers the number and the brand, and let them compare.'
  },
  {
    q: 'What if I can’t find any measurements?',
    a: 'Measure what you can (seat size and the tree points take five minutes with a tape measure), photograph the underside of the flaps, and say in your listing what you measured yourself. A local saddle fitter or tack shop can confirm the tree width.'
  }
];

/** A simple labeled diagram. Lines in gold are the measurements. */
function Figure({ caption, children, viewBox }: { caption: string; children: React.ReactNode; viewBox: string }) {
  return (
    <figure className="my-7">
      <svg viewBox={viewBox} role="img" aria-label={caption} className="w-full max-w-xl mx-auto block text-saddle-brown">
        {children}
      </svg>
      <figcaption className="text-sm text-saddle-muted text-center mt-2">{caption}</figcaption>
    </figure>
  );
}

const GOLD = '#b8893c';

function SeatDiagram() {
  return (
    <Figure viewBox="0 0 520 220" caption="Seat size: from the nailhead beside the pommel to the center of the cantle.">
      {/* seat outline, top view */}
      <path d="M90 110 C 90 60, 160 40, 260 45 C 370 50, 450 70, 455 110 C 450 150, 370 170, 260 175 C 160 180, 90 160, 90 110 Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M120 110 C 125 85, 150 75, 175 75" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <text x="70" y="40" fontSize="15" fill="currentColor">Pommel (front)</text>
      <text x="400" y="40" fontSize="15" fill="currentColor">Cantle (back)</text>
      {/* nailhead */}
      <circle cx="118" cy="80" r="6" fill={GOLD} />
      <text x="40" y="200" fontSize="14" fill="currentColor">Nailhead / screw on the side of the pommel</text>
      <line x1="80" y1="185" x2="114" y2="88" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      {/* cantle center */}
      <circle cx="455" cy="110" r="6" fill={GOLD} />
      {/* measurement */}
      <line x1="118" y1="80" x2="455" y2="110" stroke={GOLD} strokeWidth="3" strokeDasharray="8 6" />
      <text x="250" y="80" fontSize="16" fontWeight="600" fill={GOLD}>Seat size (inches)</text>
    </Figure>
  );
}

function TreeDiagram() {
  return (
    <Figure viewBox="0 0 520 260" caption="Tree width: straight across between the tips of the tree points, under the flaps.">
      {/* front view of the pommel and points */}
      <path d="M260 40 L 150 200" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <path d="M260 40 L 370 200" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <path d="M215 40 Q 260 10 305 40" fill="none" stroke="currentColor" strokeWidth="4" />
      <text x="200" y="28" fontSize="15" fill="currentColor">Pommel</text>
      <text x="30" y="120" fontSize="15" fill="currentColor">Tree point</text>
      <line x1="105" y1="125" x2="195" y2="135" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <circle cx="150" cy="200" r="7" fill={GOLD} />
      <circle cx="370" cy="200" r="7" fill={GOLD} />
      <line x1="150" y1="200" x2="370" y2="200" stroke={GOLD} strokeWidth="3" strokeDasharray="8 6" />
      <text x="170" y="230" fontSize="16" fontWeight="600" fill={GOLD}>Point to point (cm)</text>
    </Figure>
  );
}

function FlapDiagram() {
  return (
    <Figure viewBox="0 0 520 260" caption="Flap length: from the stirrup bar down to the bottom edge of the flap.">
      {/* side view: seat line and flap */}
      <path d="M60 70 C 140 40, 300 40, 460 60" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M150 75 C 150 75, 120 170, 140 230 L 300 230 C 300 170, 280 110, 270 70" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="185" y="66" width="34" height="12" rx="3" fill={GOLD} />
      <text x="230" y="40" fontSize="15" fill="currentColor">Stirrup bar</text>
      <line x1="228" y1="44" x2="210" y2="64" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="202" y1="80" x2="202" y2="230" stroke={GOLD} strokeWidth="3" strokeDasharray="8 6" />
      <text x="320" y="160" fontSize="16" fontWeight="600" fill={GOLD}>Flap length (inches)</text>
      <text x="320" y="185" fontSize="14" fill="currentColor">Note if it&apos;s cut forward</text>
    </Figure>
  );
}

function Body() {
  return (
    <>
      <Callout>
        <strong>What buyers look for first:</strong> seat size and tree width. If those are missing, most riders scroll
        past, because they can&apos;t tell whether the saddle will fit them or their horse. Ten minutes with a tape
        measure and your phone camera fixes that.
      </Callout>

      <H2 id="you-need">What you need</H2>
      <UL>
        <li>A soft tape measure (a sewing tape works best; a metal tape is fine for straight lines)</li>
        <li>Your phone, for photos</li>
        <li>Good light, and the saddle on a stand, a fence rail or the back of a sofa</li>
      </UL>

      <H2 id="stamp">Step 1: Look for the stamp first</H2>
      <P>
        Most saddles tell you their sizes. Lift each flap and look for a stamp or small metal plate. The usual places:
      </P>
      <UL>
        <li>The underside of the skirt, near the stirrup bar</li>
        <li>The panel, under the flap</li>
        <li>A nameplate on the back of the cantle</li>
        <li>Along the billets or on a tag</li>
      </UL>
      <P>Here&apos;s how to read what you find:</P>
      <UL>
        <li>
          <strong>Seat size:</strong> a number like 16.5, 17 or 17.5 (inches).
        </li>
        <li>
          <strong>Tree width:</strong> letters like N (narrow), MN (medium narrow), M (medium), MW (medium wide), W (wide)
          or XW (extra wide); or a number in centimeters like 28, 31 or 32; or a colored gullet plate if the saddle has a
          changeable gullet.
        </li>
        <li>
          <strong>Flap:</strong> a code like 2A, 3L or +2, which is the brand&apos;s own flap length and position code.
        </li>
        <li>
          <strong>Serial number or date code:</strong> often a longer number. The maker can usually tell you the year
          and original specs from it.
        </li>
      </UL>
      <P>
        Photograph the stamp even if you can read it. Buyers trust a clear photo of the stamp more than anything typed
        in a description.
      </P>

      <H2 id="seat">Step 2: Measure the seat size</H2>
      <H3>English saddles</H3>
      <SeatDiagram />
      <OL>
        <li>Find the nailhead or screw on the side of the pommel, just below the front of the seat.</li>
        <li>Find the center of the back edge of the cantle.</li>
        <li>Measure in a straight line between them (don&apos;t follow the dip of the seat).</li>
        <li>Round to the nearest half inch. Most adult English saddles are 16 to 18 inches.</li>
      </OL>
      <H3>Western saddles</H3>
      <P>
        Measure from the back of the swell (the fork) to the top edge of the cantle, where the seat meets the binding.
        Most adult western seats are 14 to 17 inches.
      </P>

      <H2 id="tree">Step 3: Find the tree width</H2>
      <P>
        Tree width is about the horse: it&apos;s how wide the front of the saddle is where it sits over the
        withers. It&apos;s the single most important detail for fit, so if it isn&apos;t stamped, it&apos;s worth
        measuring.
      </P>
      <H3>English saddles: point to point</H3>
      <TreeDiagram />
      <OL>
        <li>
          Lift the flap. Under the front of the panel, feel for the tree point: a stiff bar running down from the pommel.
          Its tip is usually a few inches below the stirrup bar.
        </li>
        <li>Mark or hold both tips, one on each side.</li>
        <li>Measure straight across between them, in centimeters.</li>
      </OL>
      <P>
        List it as a measurement, for example &ldquo;tree measures about 29 cm point to point (not stamped).&rdquo;
        Brands label widths differently, so a 29 cm tree might be called medium by one brand and medium narrow by
        another. The number, the brand and a photo let a buyer (or their saddle fitter) judge the fit.
      </P>
      <H3>Western saddles: gullet width and bars</H3>
      <P>
        Measure across the front of the gullet (the opening under the swell) at its narrowest point, in inches. Look
        for a bar stamp such as Semi Quarter Horse, Full Quarter Horse or Arabian.
      </P>
      <Callout>
        <strong>Not sure?</strong> Say so. &ldquo;Seller measured, please confirm with your fitter&rdquo; is honest and
        still far more useful than leaving it blank. A local saddle fitter or tack shop can confirm the tree width in a
        few minutes.
      </Callout>

      <H2 id="flap">Step 4: Flap length and position</H2>
      <FlapDiagram />
      <P>
        Measure from the stirrup bar down to the bottom edge of the flap, in inches. Then note whether the flap is cut
        forward (it angles ahead of the stirrup bar, common on jumping saddles) or straight (common on dressage
        saddles). If the stamp has a flap code like 2A, include that too.
      </P>

      <H2 id="panels">Step 5: Panels and flocking</H2>
      <UL>
        <li>
          <strong>Wool flocked:</strong> panels feel firm but give a little when pressed, and can be reflocked by a
          saddler. The most common on quality English saddles.
        </li>
        <li>
          <strong>Foam:</strong> lighter and evenly springy all over; it can&apos;t be adjusted.
        </li>
        <li>
          <strong>Air panels (such as CAIR):</strong> usually labeled on the panel or stamp.
        </li>
      </UL>
      <P>
        Also mention knee or thigh blocks and whether they&apos;re fixed or adjustable (some attach with Velcro under the
        flap).
      </P>

      <H2 id="year">Step 6: The year</H2>
      <P>
        If there&apos;s a serial number or date code, send it to the maker or an authorized dealer. Many can tell you
        the year and the original specifications, including the tree width. Never guess the year; &ldquo;year
        unknown&rdquo; is fine.
      </P>

      <H2 id="photos">Step 7: The photos buyers want</H2>
      <OL>
        <li>Full side view, both sides</li>
        <li>The stamp or plate, close up and in focus</li>
        <li>Straight down onto the seat</li>
        <li>The front, looking at the pommel and gullet</li>
        <li>The underside: both panels and the channel down the middle</li>
        <li>The flaps and knee blocks</li>
        <li>Any wear, scuffs or repairs, close up (buyers trust sellers who show them)</li>
      </OL>

      <H2 id="write-it">Put it together</H2>
      <P>Here&apos;s how a complete listing reads:</P>
      <Callout>
        <span className="block font-mono text-[15px] leading-7">
          17.5&quot; close contact, brand and model
          <br />
          Tree: 31 cm (stamped), medium
          <br />
          Flap: forward, 16.5&quot; from the stirrup bar
          <br />
          Panels: wool flocked, knee blocks
          <br />
          Serial number on the stamp (photo), year unknown
          <br />
          Condition: clean and supple, light wear on the flaps (photos)
        </span>
      </Callout>
    </>
  );
}

function Conclusion() {
  return (
    <>
      <H2 id="list-it">Ready to list it?</H2>
      <P>
        Once you have your seat size and tree width, your saddle shows up for the riders it actually fits. On SaddleUp,
        buyers search by seat size and tree width, so a measured saddle reaches the right people. It&apos;s free to list
        during our beta, and the total fee is {SELLER_FEE_PERCENT}% only if it sells.
      </P>
      <P>
        Already have a SaddleUp listing? Open it from your <A href="/dashboard">dashboard</A> and add what you measured.
      </P>
      <CTA href={SELL}>List your saddle on SaddleUp →</CTA>
    </>
  );
}

const guide: Guide = {
  slug: 'how-to-measure-a-saddle',
  title: 'How to Measure Your Saddle: Seat Size, Tree Width, Flap and More',
  metaTitle: 'How to Measure a Saddle: Seat Size & Tree Width Guide',
  description:
    'How to find and measure your saddle’s seat size, tree width, flap length and panels, with diagrams of exactly where to measure, so buyers know it fits.',
  summary:
    'Check under the flaps for a stamp first. If there isn’t one, measure the seat from the pommel nailhead to the center of the cantle, and the tree straight across between the tips of the tree points. Photograph the stamp and the underside.',
  published: '2026-11-09',
  updated: '2026-11-09',
  readMinutes: 6,
  faqs,
  sources: [],
  note: 'Measurements describe the saddle, not the fit on a particular horse. Brands size trees differently; a qualified saddle fitter can confirm fit.',
  Body,
  Conclusion
};

export default guide;
