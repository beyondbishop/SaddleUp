'use client';

import { useState } from 'react';
import { ALL_DISCIPLINES, INTENT_LABELS, INTENTS, type Intent } from '@/lib/onboarding';
import { DISCIPLINE_LABELS, type Discipline } from '@/lib/types';

/** Why they're on SaddleUp and what they ride. Saves each change as it's made. */
export default function InterestsField({ initialIntent, initialDisciplines }: { initialIntent: Intent | null; initialDisciplines: Discipline[] }) {
  const [intent, setIntent] = useState(initialIntent);
  const [disciplines, setDisciplines] = useState(initialDisciplines);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(body: Record<string, unknown>, undo: () => void) {
    setNote(null);
    const res = await fetch('/api/account/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    if (!res?.ok) {
      undo();
      return setNote({ ok: false, text: 'That didn’t save. Please try again.' });
    }
    setNote({ ok: true, text: 'Saved.' });
  }

  const pickIntent = (k: Intent) => {
    const before = intent;
    setIntent(k);
    save({ intent: k }, () => setIntent(before));
  };
  const toggle = (d: Discipline) => {
    const before = disciplines;
    const after = disciplines.includes(d) ? disciplines.filter((x) => x !== d) : [...disciplines, d];
    setDisciplines(after);
    save({ disciplines: after }, () => setDisciplines(before));
  };

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'bg-saddle-green text-white border-saddle-green' : 'bg-white border-saddle-line hover:border-saddle-green'}`;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold mb-2">What brings you to SaddleUp?</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What brings you to SaddleUp">
          {INTENTS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={intent === k} onClick={() => pickIntent(k)} className={chip(intent === k)}>
              {INTENT_LABELS[k]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="font-semibold mb-2">What do you ride?</p>
        <div className="flex flex-wrap gap-2">
          {ALL_DISCIPLINES.map((d) => (
            <button key={d} type="button" aria-pressed={disciplines.includes(d)} onClick={() => toggle(d)} className={chip(disciplines.includes(d))}>
              {DISCIPLINE_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
      {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? 'text-saddle-green' : 'text-red-700'}`}>{note.text}</p>}
    </div>
  );
}
