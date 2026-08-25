export function Logo({
  className = '',
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'inverted';
}) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-800 text-xs font-bold text-white">
        C
      </span>
      <span>
        Corpus
        <span className={tone === 'inverted' ? 'text-brand-300' : 'text-brand-600'}>.ai</span>
      </span>
    </span>
  );
}
