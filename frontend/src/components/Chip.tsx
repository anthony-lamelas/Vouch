import type { ReactNode } from 'react';

export function Chip({
  children,
  title,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  title?: string;
  tone?: 'default' | 'accent' | 'outline';
  className?: string;
}) {
  const cls =
    tone === 'accent'
      ? 'bg-accent-soft text-accent-ink'
      : tone === 'outline'
        ? 'border border-line-2 text-ink-2 bg-surface'
        : 'bg-raised text-ink-2';
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center rounded-[3px] px-1.5 py-px text-[11.5px] leading-[17px] whitespace-nowrap ${cls} ${className}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
