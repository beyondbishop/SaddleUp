import Image from 'next/image';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo';

export const metadata = {
  title: 'Our story',
  description:
    'SaddleUp was started by a horse mom whose custom saddle turned out not to fit. It helps riders find a used saddle that fits their horse, without the hassle.',
  alternates: { canonical: `${SITE_URL}/about` }
};

const eyebrow = 'font-mono uppercase text-saddle-gold text-[11px] tracking-[0.22em]';

const HOW = [
  ['Fit comes first', 'Every saddle is listed with its seat size and tree width, so you can shop for the saddle that fits your horse, not just the one that looks right.'],
  ['Buyers and sellers, directly', 'We connect you and then get out of the way. No middlemen, no haggling through us, no hassle.'],
  ['What you buy is what you get', "Every purchase comes with a 5-day inspection. Your payment is held until you've checked the saddle is what was described."]
] as const;

export default function AboutPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-10 sm:py-16">
      <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_1fr] gap-8 min-[900px]:gap-14 items-center mb-14">
        <div>
          <div className={`${eyebrow} mb-4`}>Our story</div>
          <h1 className="font-serif font-normal text-[34px] sm:text-[44px] leading-[1.05] text-saddle-ink mb-5">
            SaddleUp started with a saddle that didn&apos;t fit.
          </h1>
          <p className="text-lg leading-relaxed text-saddle-body">
            Hi, I&apos;m Danielle. I&apos;m a mom of three boys, and two of them have horses of their own. SaddleUp isn&apos;t a
            big company. It&apos;s my answer to a problem my family has lived with.
          </p>
        </div>
        <figure>
          <div className="relative aspect-[4/3] rounded-[3px] overflow-hidden border border-saddle-line bg-saddle-paper">
            <Image
              src="/images/founder-family.jpg"
              alt="Danielle, SaddleUp's founder, with two of her sons and a stuffed toy horse at a horse event"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 520px"
              className="object-cover"
            />
          </div>
          <figcaption className="text-sm text-saddle-muted mt-2">Me with two of my three boys.</figcaption>
        </figure>
      </div>

      <div className="max-w-[680px] mx-auto space-y-5 text-[17px] leading-[1.7] text-saddle-body">
        <p>
          A few years ago, I had a saddle custom made for my horse. Two years later, I found out it didn&apos;t fit. It had
          been pinching his withers, which led to ulcers and a series of problems that took a very long time, and a lot
          of money, to unwind.
        </p>
        <p>
          Finding the right fit is hard. We love our horses, and they work so hard for us. We want to do everything we can
          to make sure they&apos;re comfortable.
        </p>
        <p>
          So, out of my own pain and frustration, I created SaddleUp: a place to find a saddle that will make your horse
          comfortable, without the hassle.
        </p>
      </div>

      <section className="max-w-[900px] mx-auto mt-14 border-y border-saddle-line py-10">
        <h2 className="font-serif text-[28px] text-saddle-ink text-center mb-8">How SaddleUp works</h2>
        <div className="grid grid-cols-1 min-[800px]:grid-cols-3 gap-8">
          {HOW.map(([title, body]) => (
            <div key={title}>
              <div className="font-serif text-[21px] text-saddle-brown mb-1.5">{title}</div>
              <p className="text-sm leading-relaxed text-saddle-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="max-w-[680px] mx-auto mt-12 text-center">
        <p className="text-[17px] leading-[1.7] text-saddle-body mb-2">
          We&apos;re new and still growing, so thank you for being here early. Every saddle listed helps another rider find
          the right fit.
        </p>
        <p className="font-serif text-xl text-saddle-ink mb-8">Danielle</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/match"
            className="bg-saddle-green text-saddle-cream px-6 py-3.5 rounded-sm font-semibold text-[14.5px] hover:bg-saddle-green-dark"
          >
            Find My Fit →
          </Link>
          <Link
            href="/dashboard"
            className="text-saddle-brown border border-saddle-brown px-6 py-3.5 rounded-sm font-semibold text-[14.5px] hover:bg-saddle-brown hover:text-saddle-cream"
          >
            Sell a saddle
          </Link>
        </div>
      </div>
    </div>
  );
}
