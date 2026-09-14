import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-spruce text-surface border-spruce hover:bg-spruce-hover hover:border-spruce-hover disabled:bg-muted disabled:border-muted',
  secondary:
    'bg-surface text-ink border-line-strong hover:border-ink-2 disabled:text-muted disabled:hover:border-line-strong',
  ghost:
    'bg-transparent text-ink-2 border-transparent hover:bg-neutral-soft hover:text-ink disabled:text-muted disabled:hover:bg-transparent',
  danger:
    'bg-surface text-neg border-line-strong hover:border-neg disabled:text-muted disabled:hover:border-line-strong',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[13px]',
  md: 'h-8 px-3 text-[14px]',
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
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control border font-medium transition-colors ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
}
