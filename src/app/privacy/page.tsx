export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto prose">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-6">
        {/* Draft wording: have a lawyer review this before relying on it. */}
        Last updated November 6, 2026
      </p>
      <p>
        SaddleUp collects the information you provide when creating an account, listing a
        saddle, or messaging another user (name, email, phone if provided, listing details,
        message content). Payment information is collected and processed directly by Stripe;
        SaddleUp does not store your card details.
      </p>
      <p className="mt-4">
        We use your email to send transactional notifications (order updates, watchlist
        alerts, messages) and, if you opt in, occasional marketing updates. We do not sell
        your personal information to third parties.
      </p>
      <p className="mt-4">
        When you use our saddle seller tool, the photos and text you add are sent to our AI provider (Anthropic) to read
        the saddle&apos;s details and estimate its value. Photos are only saved to SaddleUp if you go on to create a
        listing. To limit misuse, we count how often the tool is used from each connection using a code that changes
        daily; we don&apos;t store your IP address.
      </p>
      <p className="mt-4">
        We rely on trusted service providers to run SaddleUp: Supabase (accounts and data), Vercel (hosting), Stripe
        (payments and payouts), Shippo (shipping labels), Anthropic (the AI tools), and our email and text message
        providers. They only use your information to provide these services to us.
      </p>
      <p className="mt-4">
        To ask for a copy of your data or to have it deleted, email us at{' '}
        <a href="mailto:hello@saddleup.me" className="underline">
          hello@saddleup.me
        </a>
        .
      </p>
    </div>
  );
}
