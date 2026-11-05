import Link from 'next/link';

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Marketplace',
    links: [
      ['Browse saddles', '/saddles'],
      ['Find My Fit', '/match'],
      ['Sell a saddle', '/dashboard']
    ]
  },
  {
    title: 'Account',
    links: [
      ['Sign in', '/auth/login'],
      ['My lists', '/lists'],
      ['Orders', '/orders']
    ]
  },
  {
    title: 'Legal',
    links: [
      ['Terms', '/terms'],
      ['Privacy', '/privacy'],
      ['Seller Agreement', '/seller-agreement']
    ]
  }
];

export default function Footer() {
  return (
    <footer className="mt-5 border-t border-saddle-line bg-saddle-sand">
      <div className="max-w-[1200px] mx-auto px-8 pt-[52px] pb-[30px] grid grid-cols-2 min-[900px]:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10">
        <div className="col-span-2 min-[900px]:col-span-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="SaddleUp" className="h-[52px] w-auto block mb-3 mix-blend-multiply" />
          <p className="text-[13.5px] text-saddle-muted max-w-[280px]">
            The fitted marketplace for used English &amp; Western saddles — matched to your horse and
            rider, protected by a 5-day inspection.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold mb-3.5">
              {col.title}
            </div>
            <div className="flex flex-col gap-[9px] text-[13.5px] text-saddle-body">
              {col.links.map(([label, href]) => (
                <Link key={href} href={href} className="hover:text-saddle-brown">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-[1200px] mx-auto px-8 pb-[34px] text-[12.5px] text-saddle-faint">
        © {new Date().getFullYear()} SaddleUp. All rights reserved.
      </div>
    </footer>
  );
}
