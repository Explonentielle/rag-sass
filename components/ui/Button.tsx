import { forwardRef } from 'react';
import Link from 'next/link';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none';

// border-2 on every variant (even transparent) keeps box sizing identical
// across variants: the landing's buttons (app/landing.module.css .btn) are
// all 2px-bordered, border-color matching the fill.
const variants = {
  primary: 'border-2 border-brand-500 bg-brand-500 text-white shadow-lg shadow-brand-500/30 hover:border-brand-700 hover:bg-brand-700',
  secondary: 'border-2 border-slate-900 bg-white text-slate-900 shadow-sm hover:bg-slate-50',
  ghost: 'border-2 border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
  danger: 'border-2 border-red-300 bg-white text-red-600 hover:bg-red-50',
};

const sizes = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2.5',
  lg: 'px-6 py-3 text-base',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
);
Button.displayName = 'Button';

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonLinkProps) {
  return <Link className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
