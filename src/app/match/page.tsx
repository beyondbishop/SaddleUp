'use client';

import { useState } from 'react';
import { matchCriteria, inchesToCm } from '@/lib/matching';
import { TREE_WIDTH_LABELS } from '@/lib/types';
import Link from 'next/link';

export default function MatchPage() {
  const [horseUnit, setHorseUnit] = useState<'cm' | 'in'>('in');
  const [horseWidth, setHorseWidth] = useState('');
  const [riderInseam, setRiderInseam] = useState('');
  const [riderUnit, setRiderUnit] = useState<'cm' | 'in'>('in');

  const horseCm = horseWidth ? (horseUnit === 'in' ? inchesToCm(Number(horseWidth)) : Number(horseWidth)) : undefined;
  const inseamCm = riderInseam ? (riderUnit === 'in' ? inchesToCm(Number(riderInseam)) : Number(riderInseam)) : undefined;

  const result = matchCriteria({ horseBackWidthCm: horseCm, riderInseamCm: inseamCm });

  const params = new URLSearchParams();
  result.treeWidths?.forEach((t) => params.append('tree', t));
  if (result.seatSizeMin) params.set('seat_min', String(result.seatSizeMin));
  if (result.seatSizeMax) params.set('seat_max', String(result.seatSizeMax));

  return (
    <div className="py-12 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-saddle-brown mb-2">Find My Fit</h1>
      <p className="text-gray-600 mb-8">
        Measure your horse's back width (widest point about 4" behind the shoulder blade) and your
        inseam, and we&apos;ll show you saddles in the tree width and seat size ranges most likely to fit.
        This is a starting point, not a replacement for an in-person saddle fitter.
      </p>

      <div className="bg-white border border-saddle-tan rounded-lg p-5 mb-4">
        <label className="block font-semibold mb-2">Horse&apos;s Back Width</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={horseWidth}
            onChange={(e) => setHorseWidth(e.target.value)}
            placeholder="e.g. 13"
            className="flex-1 border rounded p-2"
          />
          <select value={horseUnit} onChange={(e) => setHorseUnit(e.target.value as 'cm' | 'in')} className="border rounded p-2">
            <option value="in">inches</option>
            <option value="cm">cm</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-saddle-tan rounded-lg p-5 mb-6">
        <label className="block font-semibold mb-2">Your Inseam</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={riderInseam}
            onChange={(e) => setRiderInseam(e.target.value)}
            placeholder="e.g. 30"
            className="flex-1 border rounded p-2"
          />
          <select value={riderUnit} onChange={(e) => setRiderUnit(e.target.value as 'cm' | 'in')} className="border rounded p-2">
            <option value="in">inches</option>
            <option value="cm">cm</option>
          </select>
        </div>
      </div>

      {(result.treeWidths || result.seatSizeMin) && (
        <div className="bg-saddle-cream border border-saddle-tan rounded-lg p-5 mb-6">
          <p className="font-semibold mb-2">Suggested range</p>
          {result.treeWidths && (
            <p className="text-sm mb-1">
              Tree width: {result.treeWidths.map((t) => TREE_WIDTH_LABELS[t]).join(' or ')}
            </p>
          )}
          {result.seatSizeMin && (
            <p className="text-sm">
              Seat size: {result.seatSizeMin}&quot; – {result.seatSizeMax}&quot;
            </p>
          )}
        </div>
      )}

      <Link
        href={`/saddles?${params.toString()}`}
        className="block text-center bg-saddle-green text-white rounded-md py-3 font-semibold"
      >
        View Matching Saddles
      </Link>
    </div>
  );
}
