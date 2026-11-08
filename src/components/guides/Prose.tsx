// Styled building blocks for guide articles. The site has no typography plugin, so each
// element carries its own classes here and the guide content stays readable JSX.

import Link from 'next/link';

export function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-serif font-normal text-[26px] sm:text-[30px] leading-tight text-saddle-ink mt-12 mb-4 scroll-mt-24">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-serif text-[21px] text-saddle-brown mt-8 mb-2.5">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[17px] leading-[1.75] text-saddle-body mb-4">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-6 mb-5 space-y-1.5 text-[17px] leading-[1.7] text-saddle-body marker:text-saddle-gold">{children}</ul>;
}

export function OL({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal pl-6 mb-5 space-y-1.5 text-[17px] leading-[1.7] text-saddle-body marker:text-saddle-gold">{children}</ol>;
}

/** Internal links use next/link; anything starting with http opens in a new tab. */
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = 'text-saddle-brown underline underline-offset-2 hover:text-saddle-ink';
  if (href.startsWith('http')) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function CTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <p className="my-7">
      <Link
        href={href}
        className="inline-block bg-saddle-green text-saddle-cream px-6 py-3.5 rounded-sm font-semibold text-[14.5px] hover:bg-saddle-green-dark"
      >
        {children}
      </Link>
    </p>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 border-l-[3px] border-saddle-gold bg-saddle-paper px-5 py-4 text-[17px] leading-[1.7] text-saddle-body">
      {children}
    </div>
  );
}
