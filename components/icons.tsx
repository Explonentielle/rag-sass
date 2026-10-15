export function Icon({
  children,
  className = 'h-5 w-5',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconBadge({
  children,
  tone = 'brand',
  size = 'md',
  spacing = 'mb-4',
}: {
  children: React.ReactNode;
  tone?: 'brand' | 'white' | 'green' | 'amber' | 'red';
  size?: 'sm' | 'md';
  spacing?: string;
}) {
  const tones = {
    brand: 'bg-brand-100 text-brand-700 shadow-lg shadow-brand-700/20',
    white: 'bg-white/10 text-white',
    green: 'bg-emerald-100 text-emerald-700 shadow-lg shadow-emerald-600/20',
    amber: 'bg-amber-100 text-amber-700 shadow-lg shadow-amber-600/20',
    red: 'bg-red-100 text-red-700 shadow-lg shadow-red-600/20',
  };
  const sizes = {
    sm: { box: 'h-8 w-8', icon: 'h-4 w-4' },
    md: { box: 'h-10 w-10', icon: 'h-5 w-5' },
  };
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-xl ${sizes[size].box} ${tones[tone]} ${spacing}`}
    >
      <Icon className={sizes[size].icon}>{children}</Icon>
    </div>
  );
}

export const ICONS = {
  upload: (
    <>
      <line x1="12" y1="4" x2="12" y2="15" />
      <polyline points="8,8 12,4 16,8" />
      <polyline points="4,15 4,19 20,19 20,15" />
    </>
  ),
  index: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <line x1="5" y1="6" x2="5" y2="16" />
      <line x1="19" y1="6" x2="19" y2="16" />
      <ellipse cx="12" cy="16" rx="7" ry="2.5" />
    </>
  ),
  chat: (
    <>
      <rect x="3" y="5" width="18" height="11" rx="2" />
      <polyline points="8,16 7,20 11,16" />
    </>
  ),
  quote: (
    <>
      <rect x="5" y="6" width="4" height="5" rx="1" />
      <rect x="13" y="6" width="4" height="5" rx="1" />
      <line x1="7" y1="11" x2="5" y2="16" />
      <line x1="15" y1="11" x2="13" y2="16" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8,12 11,15 16,9" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <line x1="15" y1="15" x2="20" y2="20" />
    </>
  ),
  shield: (
    <>
      <polygon points="12,3 19,6 19,12 12,21 5,12 5,6" />
      <polyline points="9,12 11,14 15,10" />
    </>
  ),
  document: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </>
  ),
  bolt: <polygon points="13,2 4,14 11,14 10,22 20,9 13,9" />,
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <polyline points="8,7 8,4 16,4 16,7" />
      <line x1="3" y1="13" x2="21" y2="13" />
    </>
  ),
  headset: (
    <>
      <circle cx="12" cy="10" r="7" />
      <rect x="3" y="10" width="3" height="6" rx="1" />
      <rect x="18" y="10" width="3" height="6" rx="1" />
      <line x1="12" y1="17" x2="12" y2="19" />
    </>
  ),
  book: (
    <>
      <rect x="4" y="5" width="8" height="14" rx="1" />
      <rect x="12" y="5" width="8" height="14" rx="1" />
      <line x1="12" y1="5" x2="12" y2="19" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>
  ),
  layers: (
    <>
      <polygon points="12,3 21,8 12,13 3,8" />
      <polyline points="3,13 12,18 21,13" />
      <polyline points="3,17.5 12,22 21,17.5" />
    </>
  ),
  settings: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="7" cy="18" r="2" />
    </>
  ),
  close: (
    <>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </>
  ),
  alert: (
    <>
      <polygon points="12,3 22,20 2,20" />
      <line x1="12" y1="9" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </>
  ),
  logout: (
    <>
      <rect x="4" y="4" width="10" height="16" rx="1" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <polyline points="16,8 20,12 16,16" />
    </>
  ),
};
