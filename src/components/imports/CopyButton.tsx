'use client';
import { useState } from 'react';

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt('Copy this:', text);
        }
      }}
      className="text-sm border border-saddle-brown text-saddle-brown px-3 py-1.5 rounded-sm hover:bg-saddle-brown hover:text-saddle-cream"
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}
