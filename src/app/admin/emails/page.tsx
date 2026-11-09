import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/roles';
import { WELCOME_FROM, welcomeEmail } from '@/lib/welcome';
import SendTestEmail from '@/components/admin/SendTestEmail';
import { previewOrderEmails } from '@/lib/notify';
import { loginLinkEmail } from '@/lib/login-link';
import { CONFIRM_SIGNUP, previewConfirmSignup } from '@/lib/auth-emails';
import { previewListingEmails } from '@/lib/listing-emails';
import { previewMessageAlerts } from '@/lib/message-alerts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Emails · Admin', robots: { index: false } };

// Every email SaddleUp sends, in the order a member meets them, rendered from the real
// templates with sample data. What you see here is exactly what goes out.

type Preview = { id: string; when: string; to: string; from?: string; testKind?: string; subject: string; html: string; text: string; sms?: string; source?: string };

const ORDER_WHEN: Record<string, string> = {
  paid: 'Right after checkout',
  dispatch_reminder: 'Seller hasn’t shipped, deadline close',
  dispatch_overdue: 'Seller missed the ship-by date',
  shipped: 'Carrier scans the package',
  delivered: 'Carrier confirms delivery',
  inspection_reminder_2d: '2 days before inspection ends',
  inspection_reminder_1d: '1 day before inspection ends',
  kept: 'Buyer taps “Keep this saddle” but the payout can’t go out yet (usually it does, and the next email covers both)',
  inspection_expired: 'Inspection ends with no action',
  payout_sent: 'Seller is paid: when the buyer taps Keep (shown) or the trial ends',
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
      {p.id === 'welcome' && <SendTestEmail kind="welcome" />}
      {p.testKind && <SendTestEmail kind={p.testKind} />}
      <details className="px-4 py-2 border-t border-saddle-line text-sm">
        <summary className="cursor-pointer text-saddle-muted">Plain-text version{p.sms ? ' and text message' : ''}</summary>
        <pre className="whitespace-pre-wrap text-xs mt-2 font-mono">{p.text}</pre>
        {p.sms && <p className="text-xs mt-2"><strong>Text:</strong> {p.sms} https://saddleup.me/…</p>}
      </details>
      {p.source && (
        <details className="px-4 py-2 border-t border-saddle-line text-sm">
          <summary className="cursor-pointer text-saddle-muted">Supabase template source (paste into Supabase → Authentication → Emails)</summary>
          <pre className="whitespace-pre-wrap text-xs mt-2 font-mono select-all">{p.source}</pre>
        </details>
      )}
    </article>
  );
}

export default async function AdminEmailsPage() {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect('/auth/login?next=/admin/emails');
  if (!isAdmin) redirect('/');

  const welcome = welcomeEmail('Jane Rider');
  const onboarding: Preview[] = [
    {
      id: 'confirm-signup',
      when: 'Right after signing up with email (sent by Supabase)',
      to: 'New member',
      from: 'Danielle Bishop',
      ...previewConfirmSignup(),
      source: CONFIRM_SIGNUP.html
    },
    { id: 'welcome', when: 'Once, when they create an account', to: 'New member', from: WELCOME_FROM, ...welcome },
    { id: 'login-link', when: '“Forgot password?”, or you tap “Email sign-in link” on Users', to: 'Member', ...loginLinkEmail('Jane Rider', 'jane@example.com', 'https://saddleup.me/auth/confirm?token_hash=…') }
  ];

  const listingEmails = previewListingEmails();
  const listing: Preview[] = [
    { id: 'listing-submitted', when: 'Right after a seller adds a saddle', to: 'Seller', ...listingEmails.submitted },
    { id: 'listing-submitted-no-tree', when: 'Same, when the seller saved it without a tree width (the live email gets the same box)', to: 'Seller', ...listingEmails.submittedNoTree },
    { id: 'listing-live', when: 'You approve it in the review queue', to: 'Seller', ...listingEmails.live }
  ];

  const msgAlerts = previewMessageAlerts();
  const messages: Preview[] = [
    { id: 'message-to-seller', when: 'A buyer messages about a saddle (max one per conversation every 30 min)', to: 'Seller', ...msgAlerts.toSeller },
    { id: 'message-to-buyer', when: 'The seller replies', to: 'Buyer', ...msgAlerts.toBuyer }
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
      sms: e.sms,
      from: e.from,
      // Emails already in the personal style can be sent to yourself (sample sale, your name).
      testKind: e.from ? `order:${e.event}:${e.role}` : undefined
    }));

  const sections = [
    { title: 'Joining and signing in', blurb: 'What someone gets when they sign up, or when you send them a sign-in link.', items: onboarding },
    { title: 'Listing a saddle', blurb: 'Sent to the seller when they add a saddle, and again when it goes live.', items: listing },
    { title: 'Messages', blurb: 'Sent when someone messages about a saddle. Also by text if they turned text alerts on.', items: messages },
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
