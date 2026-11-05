'use client';
import { useState } from 'react';

export default function ConnectPayoutsButton({ label = 'Set Up Payouts' }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function connect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? 'Something went wrong. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }
  return (
    <div className="text-right">
      <button onClick={connect} disabled={loading} className="bg-saddle-brown text-white px-4 py-2 rounded-md text-sm whitespace-nowrap">
        {loading ? 'Loading…' : label}
      </button>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
