'use client';

import { useState } from 'react';
import { Icon, ICONS } from '@/components/icons';
import type { ContractSummaryJson } from '@/types/database';

const SUMMARY_FIELDS: { key: keyof ContractSummaryJson; label: string }[] = [
  { key: 'parties', label: 'Parties' },
  { key: 'objet', label: 'Objet' },
  { key: 'dureeEtReconduction', label: 'Durée et reconduction' },
  { key: 'conditionsResiliation', label: 'Conditions de résiliation' },
  { key: 'penalites', label: 'Pénalités' },
  { key: 'modalitesPaiement', label: 'Modalités de paiement' },
  { key: 'clauseConfidentialite', label: 'Clause de confidentialité' },
  { key: 'clauseNonConcurrence', label: 'Clause de non-concurrence' },
  { key: 'pointsNotables', label: 'Points notables' },
];

// Collapsed by default (docs/roadmap.md item 23): 9 fields shown in full at
// once made the card a wall of text (some, like "pénalités" or "points
// notables", run several sentences). Each row previews one line, click to
// expand — nothing hidden, just not all open at once.
export default function ContractSummaryAccordion({ summary }: { summary: ContractSummaryJson }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="divide-y divide-slate-100">
      {SUMMARY_FIELDS.map(({ key, label }) => {
        const value = summary[key] ?? 'Non applicable.';
        const open = openKeys.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-expanded={open}
            className="flex w-full flex-col gap-1 px-5 py-4 text-left transition-colors hover:bg-slate-50"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-900">{label}</span>
              <Icon
                className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
              >
                {ICONS.chevronDown}
              </Icon>
            </span>
            <span className={`text-sm text-slate-600 ${open ? '' : 'line-clamp-1'}`}>{value}</span>
          </button>
        );
      })}
    </div>
  );
}
