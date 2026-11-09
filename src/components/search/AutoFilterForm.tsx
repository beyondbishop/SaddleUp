'use client';

// The /saddles filter form, applied as soon as something changes: dropdowns and checkboxes right
// away, typed boxes after a short pause. Uses client navigation so the box being typed in keeps
// focus. Without JavaScript it is still a plain GET form with an Apply button.

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition, type ReactNode } from 'react';

const TYPING_DELAY = 600;

export default function AutoFilterForm({ action, className, children }: { action: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const lastUrl = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = () => {
    clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    // Half-typed values (e.g. a 3-digit ZIP) wait until they're valid.
    if (!form.checkValidity()) return;
    const params = new URLSearchParams();
    new FormData(form).forEach((v, k) => {
      if (typeof v === 'string' && v.trim() !== '') params.append(k, v.trim());
    });
    const qs = params.toString();
    const url = qs ? `${action}?${qs}` : action;
    if (url === lastUrl.current) return;
    lastUrl.current = url;
    startTransition(() => router.replace(url, { scroll: false }));
  };

  const isTyped = (t: EventTarget) =>
    t instanceof HTMLInputElement && !['checkbox', 'radio'].includes(t.type);

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onInput={(e) => {
        if (!isTyped(e.target)) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(apply, TYPING_DELAY);
      }}
      onChange={(e) => {
        if (!isTyped(e.target)) apply();
      }}
    >
      {children}
      <p role="status" className="text-xs text-center text-gray-500 h-4">{pending ? 'Updating results…' : ''}</p>
    </form>
  );
}
