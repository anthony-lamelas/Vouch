import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover disabled:bg-faint disabled:border-faint',
  secondary: 'bg-surface text-ink border-line-2 hover:bg-ground disabled:text-faint',
  ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-raised disabled:text-faint',
  danger: 'bg-surface text-neg border-neg/40 hover:bg-neg-soft disabled:text-faint',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-8 px-3 text-[13px]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded border font-medium transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
}
