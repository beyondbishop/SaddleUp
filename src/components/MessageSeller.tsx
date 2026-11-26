'use client';
import { useEffect, useState } from 'react';
import InquiryBox from '@/components/InquiryBox';

/** "Message <seller>" on a listing: opens the message box in place. Also opens when the page is
 *  reached with #message-seller (the "Questions?" link by the Buy button jumps here). */
export default function MessageSeller({ listingId, sellerId, firstName }: { listingId: string; sellerId: string; firstName: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      if (window.location.hash === '#message-seller') setOpen(true);
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  return (
    <div id="message-seller" className="scroll-mt-24">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto bg-saddle-brown text-white px-4 py-2 rounded-md font-semibold text-sm"
        >
          Message {firstName}
        </button>
      ) : (
        <div className="mt-1">
          <p className="text-sm font-semibold text-saddle-ink">Ask {firstName} a question</p>
          <p className="text-xs text-saddle-muted">They&apos;ll get an email (and a text if they&apos;ve turned texts on). Replies show in your Messages.</p>
          <InquiryBox listingId={listingId} sellerId={sellerId} buttonLabel={`Send to ${firstName}`} autoFocus />
        </div>
      )}
    </div>
  );
}
