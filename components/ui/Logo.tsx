// Même motif "document à coin plié" que app/page.tsx (LogoMark), pour une
// identité cohérente entre la landing et le dashboard, plutôt qu'une
// simple lettre "C".
export function Logo({
  className = '',
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'inverted';
}) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#A8341F]">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M7 2 H15 L20 7 V19 Q20 22 17 22 H7 Q4 22 4 19 V5 Q4 2 7 2 Z" fill="#F3ECD9" />
          <path d="M15 2 L20 7 H15 Z" fill="#8B6B3D" />
        </svg>
      </span>
      <span>
        Corpus
        <span className={tone === 'inverted' ? 'text-brand-300' : 'text-brand-600'}>.ai</span>
      </span>
    </span>
  );
}
