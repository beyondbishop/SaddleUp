export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto prose">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-6">
        Placeholder template — have a lawyer review and customize this before launch.
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
        Contact us at privacy@yourdomain.com with any data access or deletion requests.
      </p>
    </div>
  );
}
