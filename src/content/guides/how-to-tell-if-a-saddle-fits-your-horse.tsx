import { A, Callout, CTA, H2, H3, OL, P, UL } from '@/components/guides/Prose';
import { seatPath, treePath } from '@/lib/seo';
import type { Guide } from './types';

const faqs: Guide['faqs'] = [
  {
    q: 'How many fingers should fit between the saddle and the withers?',
    a: 'Without a rider, about two to three fingers stacked between the underside of the pommel and the top of the withers. Check again with a rider in the saddle: it should still clear by about two fingers, and the sides of the withers should not be pinched.'
  },
  {
    q: 'How do I know if a saddle tree is too narrow or too wide?',
    a: 'A tree that is too narrow sits high in front, pinches at the top of the panels and tips the saddle back toward the cantle. A tree that is too wide sits low in front, gets close to or touches the withers and tips the saddle forward. When the width is right, the seat is level and the front of the panels presses evenly from top to bottom.'
  },
  {
    q: 'What is bridging in a saddle?',
    a: 'Bridging is when the panels touch the horse at the front and back but not in the middle, so the rider’s weight is carried on two small areas. You can feel it by sliding a flat hand under the panel from front to back: you’ll feel a gap in the middle. Rocking is the opposite, where the middle touches and the ends lift.'
  },
  {
    q: 'How do I know if the seat size is right for me?',
    a: 'Sit in the deepest part of the seat with your leg in position. There should be roughly a hand’s width between your seat and the cantle, and your knee should sit inside the front edge of the flap or knee roll. If you’re pushed against the cantle or your knee goes over the flap, the seat or flap is too small.'
  },
  {
    q: 'Can a used saddle be adjusted to fit my horse?',
    a: 'Often, within limits. Wool-flocked panels can be reflocked by a saddle fitter to fine-tune contact and balance, and saddles with an adjustable tree or changeable gullet can change width. A fixed tree that is the wrong width can’t be fixed by flocking, so get the tree width right first.'
  },
  {
    q: 'What do dry spots in the sweat pattern mean?',
    a: 'After a ride, an even damp pattern under the panels is a good sign. Small dry patches inside the sweaty area can mean heavy pressure points, where the saddle pressed so hard that the sweat glands couldn’t work. Treat it as a clue to check, not proof, and ask a fitter if you see it.'
  }
];

function Body() {
  return (
    <>
      <Callout>
        <strong>The short version:</strong> a saddle fits your horse when it clears the withers and spine, the tree
        matches the angle of the shoulders, the panels touch evenly from front to back, the seat sits level, and it ends
        before the last rib. It fits you when there&apos;s about a hand&apos;s width behind your seat and your knee sits
        inside the flap.
      </Callout>

      <P>
        Buying a used saddle means you usually can&apos;t try it before it arrives. These are the same checks a saddle
        fitter starts with, in order, so you can tell within a few minutes whether a saddle is worth keeping and what to
        ask a fitter about. If you haven&apos;t found a saddle yet, start with the seat size and tree width you need:
        every SaddleUp listing shows both.
      </P>

      <H2 id="before">Before you start</H2>
      <UL>
        <li>Stand your horse square on flat, level ground.</li>
        <li>
          Put the saddle on <strong>without a pad</strong> first. A pad can hide a poor fit, so you only add it back
          for the ride.
        </li>
        <li>
          Set it a little too far forward, on top of the shoulder, then slide it back until it settles in its natural
          spot behind the shoulder blade. The tree points should sit behind the shoulder blade, not on it.
        </li>
        <li>Do the girth up loosely, just enough to keep the saddle in place.</li>
      </UL>

      <H2 id="horse">Part 1: Does it fit your horse?</H2>

      <H3>1. Wither clearance</H3>
      <P>
        Slide your fingers, stacked flat, between the underside of the pommel and the top of the withers. You want about
        two to three fingers without a rider. Then run your fingers down the sides of the withers under the front of the
        panels: they shouldn&apos;t feel pinched.
      </P>

      <H3>2. Tree width and angle</H3>
      <P>
        The tree points should run roughly parallel to the angle of your horse&apos;s shoulder. Slide a flat hand under
        the front of the panel, from top to bottom. The pressure should feel even all the way down.
      </P>
      <UL>
        <li>
          <strong>Too narrow:</strong> tight at the top and loose at the bottom, pommel sitting high, saddle tipping back
          toward the cantle.
        </li>
        <li>
          <strong>Too wide:</strong> loose at the top and tight at the bottom, pommel sitting low and close to the
          withers, saddle tipping forward.
        </li>
      </UL>
      <P>
        Tree width is the one thing reflocking can&apos;t fix on a fixed-tree saddle. Brands label widths differently,
        so use the listing&apos;s width as a starting point and this check as the real test. You can browse by width,
        for example <A href={treePath('medium')}>medium tree saddles</A> or{' '}
        <A href={treePath('medium_wide')}>medium/wide tree saddles</A>.
      </P>

      <H3>3. Level balance</H3>
      <P>
        Step back and look from the side. The deepest point of the seat should be in the middle, with the seat level
        from front to back. If the cantle is much lower than the pommel, the tree may be too narrow; if the pommel is
        lower, it may be too wide. A rider sitting in an unbalanced saddle gets tipped forward or back with every
        stride.
      </P>

      <H3>4. Spine clearance</H3>
      <P>
        Stand behind your horse (safely) and look down the channel between the panels. You should see daylight the whole
        length, and the channel should be wide enough not to touch the spine or the muscles beside it, usually about
        three to four fingers wide. A channel that narrows or touches the spine anywhere is a no.
      </P>

      <H3>5. Even panel contact</H3>
      <P>
        Slide a flat hand under each panel from front to back. You want steady, even contact the whole way.
      </P>
      <UL>
        <li>
          <strong>Bridging:</strong> contact at the front and back, a gap in the middle.
        </li>
        <li>
          <strong>Rocking:</strong> contact in the middle, the front or back lifting. Press on the pommel and cantle
          in turn; if the saddle seesaws, it rocks.
        </li>
      </UL>
      <P>
        On wool-flocked saddles, small contact problems can often be fixed by a fitter with reflocking. Big ones usually
        mean the tree shape is wrong for your horse&apos;s back.
      </P>

      <H3>6. Saddle length</H3>
      <P>
        Find your horse&apos;s last rib and follow it up to the spine. The panels should end in front of that point.
        Weight carried behind the last rib presses on the loins, where the back is least able to carry it. Short-backed
        horses often need a shorter panel, whatever the seat size.
      </P>

      <H3>7. Girth position</H3>
      <P>
        With the girth done up, the billets should hang roughly straight down to the girth groove, the narrowest part
        of the ribcage behind the elbow. If the girth pulls the saddle forward onto the shoulder, or the billets angle
        sharply, the billet position may not suit your horse.
      </P>

      <H2 id="rider">Part 2: Does it fit you?</H2>
      <OL>
        <li>
          <strong>Seat size:</strong> sit in the deepest part of the seat with your leg in position. There should be
          roughly a hand&apos;s width between your seat and the cantle. Pushed against the cantle means too small; sliding
          around means too big. Most adults ride in 16.5&quot; to 18&quot;, and you can browse a size directly, such as{' '}
          <A href={seatPath(17)}>17&quot; saddles</A> or <A href={seatPath(17.5)}>17.5&quot; saddles</A>.
        </li>
        <li>
          <strong>Flap length and position:</strong> with your stirrups at jumping length, your knee should sit inside
          the front edge of the flap or knee roll, not over it, and the flap should come down past your knee.
        </li>
        <li>
          <strong>Twist:</strong> the narrow part of the seat just behind the pommel. If your hips or knees ache after a
          short ride, the twist may be too wide for you.
        </li>
      </OL>
      <P>
        If you can&apos;t sit in it on the horse yet, sit in it on a saddle stand to get a rough idea of seat size and
        flap length.
      </P>

      <H2 id="ride">Part 3: The ride test</H2>
      <P>
        The checks above tell you a lot, but the real test is riding in it. That&apos;s what your trial is for: ride
        in it a few times during the 5 days, in the work you normally do.
      </P>
      <UL>
        <li>
          <strong>It stays put.</strong> At walk, trot and canter the saddle shouldn&apos;t slide forward, slip back or
          swing from side to side. Ask someone to watch from behind: the back of the saddle shouldn&apos;t bounce.
        </li>
        <li>
          <strong>Your horse moves freely.</strong> Watch for a shortened stride, a hollow back, head tossing, tail
          swishing or reluctance to go forward.
        </li>
        <li>
          <strong>You&apos;re balanced.</strong> You shouldn&apos;t feel pitched forward or pushed back, or have to fight
          to keep your leg underneath you.
        </li>
        <li>
          <strong>Check the sweat pattern.</strong> After the ride, the damp area under the panels should be even. Small
          dry spots inside it can mean pressure points worth asking a fitter about.
        </li>
      </UL>

      <H2 id="used">Part 4: Checks that matter on a used saddle</H2>
      <UL>
        <li>
          <strong>The tree is sound.</strong> Hold the pommel and cantle and gently try to flex the saddle. A spring tree
          gives a little; a broken tree feels loose, clicks, or twists unevenly. Also squeeze across the pommel: it
          shouldn&apos;t move.
        </li>
        <li>
          <strong>The panels are even.</strong> Look at the panels from behind. Lumps, hard spots or one side sitting
          lower than the other often mean the flocking needs work.
        </li>
        <li>
          <strong>The stamp matches the listing.</strong> Check the seat size and tree width stamped under the flap
          against what was listed. Our <A href="/guides/how-to-measure-a-saddle">measuring guide</A> shows where to look.
        </li>
        <li>
          <strong>Billets, stitching and leather</strong> are in safe condition, with no cracked billets or loose
          stitching around the stirrup bars.
        </li>
      </UL>

      <H2 id="warning-signs">Warning signs of a poor fit</H2>
      <P>Even if a saddle passes the checks, stop using it and get a fitter&apos;s opinion if you notice:</P>
      <UL>
        <li>Rubbed or white hairs, swelling or heat under the saddle area</li>
        <li>Your horse flinching when you brush their back, or pinning their ears or moving away when saddled</li>
        <li>New bucking, rearing or refusing that began with this saddle</li>
      </UL>
    </>
  );
}

function Conclusion() {
  return (
    <>
      <H2 id="trial">Use your 5-day inspection window</H2>
      <P>
        Every saddle bought on SaddleUp comes with a 5-day window after delivery. We hold your payment until you confirm
        the saddle is right. Do the checks above as soon as it arrives, then ride in it. If it doesn&apos;t fit, send it
        back: you pay return shipping, or the seller does if it isn&apos;t as described. See the{' '}
        <A href="/terms">full terms</A> for details.
      </P>
      <P>
        Every listing shows the saddle&apos;s seat size and tree width, so you can start with saddles that match your
        horse and you.
      </P>
      <CTA href="/saddles">Browse saddles by seat size and tree width →</CTA>
    </>
  );
}

const guide: Guide = {
  slug: 'how-to-tell-if-a-saddle-fits-your-horse',
  title: 'How to Tell If a Saddle Fits Your Horse (and You)',
  metaTitle: 'How to Tell If a Saddle Fits Your Horse: 7 Checks',
  description:
    'Seven checks to tell if a used English saddle fits your horse: wither clearance, tree width, balance, spine clearance, panel contact, length and girth, plus how to check it fits you.',
  summary:
    'A saddle fits your horse when it clears the withers and spine, the tree matches the shoulder angle, the panels touch evenly, the seat is level and it ends before the last rib. It fits you when there’s about a hand’s width behind your seat and your knee sits inside the flap.',
  published: '2026-11-28',
  updated: '2026-11-28',
  readMinutes: 8,
  faqs,
  sources: [],
  note: 'This guide covers general checks, not a professional fitting. Every horse is different, and backs change with work, age and season; a qualified saddle fitter can confirm the fit and adjust it.',
  Body,
  Conclusion
};

export default guide;
