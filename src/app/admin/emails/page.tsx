import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/roles';
import { WELCOME_FROM, welcomeEmail } from '@/lib/welcome';
import { previewOrderEmails } from '@/lib/notify';
import { loginLinkEmail } from '@/lib/login-link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Emails · Admin', robots: { index: false } };

// Every email SaddleUp sends, in the order a member meets them, rendered from the real
// templates with sample data. What you see here is exactly what goes out.

type Preview = { id: string; when: string; to: string; from?: string; subject: string; html: string; text: string; sms?: string };

const ORDER_WHEN: Record<string, string> = {
  paid: 'Right after checkout',
  dispatch_reminder: 'Seller hasn’t shipped, deadline close',
  dispatch_overdue: 'Seller missed the ship-by date',
  shipped: 'Carrier scans the package',
  delivered: 'Carrier confirms delivery',
  inspection_reminder_2d: '2 days before inspection ends',
  inspection_reminder_1d: '1 day before inspection ends',
  kept: 'Buyer taps “Keep this saddle”',
  inspection_expired: 'Inspection ends with no action',
  payout_sent: 'Seller is paid',
  payout_failed: 'Seller payout fails',
  return_requested: 'Buyer requests a return',
  problem_reported: 'Buyer reports a problem',
  delivery_problem: 'Carrier reports a delivery problem',
  review_resolved: 'We resolve a review',
  refunded: 'Buyer is refunded'
};
const ORDER_SEQUENCE = Object.keys(ORDER_WHEN);
const ROLE_LABEL = { buyer: 'Buyer', seller: 'Seller', admin: 'Admin (you)' } as const;

function EmailCard({ p }: { p: Preview }) {
  return (
    <article id={p.id} className="border border-saddle-line rounded-lg overflow-hidden bg-white scroll-mt-6">
      <header className="px-4 py-3 border-b border-saddle-line bg-saddle-cream/60">
        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-saddle-muted">
          {p.when} · to {p.to} · from {p.from ?? 'SaddleUp'}
        </p>
        <p className="font-semibold text-saddle-ink mt-0.5">{p.subject}</p>
      </header>
      <iframe title={p.subject} srcDoc={p.html} className="w-full h-[420px] bg-white" sandbox="" />
      <details className="px-4 py-2 border-t border-saddle-line text-sm">
        <summary className="cursor-pointer text-saddle-muted">Plain-text version{p.sms ? ' and text message' : ''}</summary>
        <pre className="whitespace-pre-wrap text-xs mt-2 font-mono">{p.text}</pre>
        {p.sms && <p className="text-xs mt-2"><strong>Text:</strong> {p.sms} https://saddleup.me/…</p>}
      </details>
    </article>
  );
}

export default async function AdminEmailsPage() {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/admin/emails');
  if (!isAdmin) redirect('/');

  const welcome = welcomeEmail('Jane Rider');
  const onboarding: Preview[] = [
    { id: 'welcome', when: 'Once, when they create an account', to: 'New member', from: WELCOME_FROM, ...welcome },
    { id: 'login-link', when: 'You tap “Email sign-in link” on Users', to: 'Member', ...loginLinkEmail('Jane Rider', 'jane@example.com', 'https://saddleup.me/auth/confirm?token_hash=…') }
  ];

  const orders: Preview[] = previewOrderEmails()
    .sort((a, b) => ORDER_SEQUENCE.indexOf(a.event) - ORDER_SEQUENCE.indexOf(b.event))
    .map((e) => ({
      id: `${e.event}-${e.role}`,
      when: ORDER_WHEN[e.event] ?? e.event,
      to: ROLE_LABEL[e.role],
      subject: e.subject,
      html: e.html,
      text: e.text,
      sms: e.sms
    }));

  const sections = [
    { title: 'Joining and signing in', blurb: 'What someone gets when they sign up, or when you send them a sign-in link.', items: onboarding },
    { title: 'Buying and selling', blurb: 'Sent as an order moves along. Happy path first, then the exceptions.', items: orders }
  ];

  return (
    <div className="py-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-saddle-brown">Emails</h1>
      <p className="text-saddle-muted mt-1 text-sm">
        Every email SaddleUp sends, in the order a member gets them. Sample names and orders; the layout and wording are the real thing.
      </p>

      {sections.map((s) => (
        <section key={s.title} className="mt-8">
          <h2 className="text-lg font-semibold text-saddle-ink">{s.title}</h2>
          <p className="text-sm text-saddle-muted mb-3">{s.blurb}</p>
          <ol className="text-sm mb-4 space-y-0.5">
            {s.items.map((p, i) => (
              <li key={p.id}>
                <span className="text-saddle-muted font-mono text-xs mr-2">{i + 1}.</span>
                <a href={`#${p.id}`} className="underline decoration-saddle-line hover:decoration-saddle-ink">{p.subject}</a>
                <span className="text-saddle-muted"> · {p.to}</span>
              </li>
            ))}
          </ol>
          <div className="space-y-6">
            {s.items.map((p) => <EmailCard key={p.id} p={p} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
