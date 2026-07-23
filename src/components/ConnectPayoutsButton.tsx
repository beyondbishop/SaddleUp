'use client';
import { useState } from 'react';

export default function ConnectPayoutsButton() {
  const [loading, setLoading] = useState(false);
  async function connect() {
    setLoading(true);
    const res = await fetch('/api/stripe/connect', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  }
  return (
    <button onClick={connect} disabled={loading} className="bg-saddle-brown text-white px-4 py-2 rounded-md text-sm whitespace-nowrap">
      {loading ? 'Loading…' : 'Set Up Payouts'}
    </button>
  );
}
