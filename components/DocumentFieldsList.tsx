import type { ExtractedFieldsJson } from '@/types/database';

// Paires label/valeur courtes (contrairement aux champs du résumé de
// contrat, qui sont des phrases) : une grille à deux colonnes suffit, pas
// besoin de l'accordéon de components/ContractSummaryAccordion.tsx
// (docs/roadmap.md item 24).
export default function DocumentFieldsList({ fields }: { fields: ExtractedFieldsJson }) {
  if (fields.length === 0) {
    return <p className="px-5 py-4 text-sm text-slate-400">Aucun champ extrait de ce document.</p>;
  }

  return (
    <dl className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
      {fields.map(({ label, value }, i) => (
        <div key={`${label}-${i}`}>
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          <dd className="text-sm text-slate-900">{value || 'Non précisé'}</dd>
        </div>
      ))}
    </dl>
  );
}
