// Même motif "documents empilés" que app/page.tsx (LogoMark) : deux
// rectangles arrondis décalés, pour une identité cohérente entre la landing
// et le dashboard, plutôt qu'une simple lettre "C".
export function Logo({
  className = '',
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'inverted';
}) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-brand-700">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <rect x="9" y="3" width="12" height="12" rx="3" fill="#A9782E" opacity="0.6" />
          <rect x="3" y="9" width="12" height="12" rx="3" fill="#F3F7F2" />
        </svg>
      </span>
      <span>
        Corpus
        <span className={tone === 'inverted' ? 'text-brand-300' : 'text-brand-600'}>.ai</span>
      </span>
    </span>
  );
}
