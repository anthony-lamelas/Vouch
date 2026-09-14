import type { ReactNode } from 'react';

/** A quiet outlined label. Never a button on its own; wrap it if it needs to act. */
export function Chip({
  children,
  title,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  title?: string;
  tone?: 'default' | 'accent';
  className?: string;
}) {
  const cls =
    tone === 'accent'
      ? 'border-spruce-soft bg-spruce-soft text-spruce-ink'
      : 'border-line-strong bg-surface text-ink-2';
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center rounded-control border px-1.5 text-[12.5px] leading-[18px] whitespace-nowrap ${cls} ${className}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

/** An applied filter: the value plus a remove control. */
export function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-control border border-line-strong bg-surface text-[13px] leading-[22px] text-ink">
      <span className="truncate pl-2">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="ml-0.5 inline-flex h-[22px] w-5 items-center justify-center rounded-r-control text-muted hover:bg-neutral-soft hover:text-ink"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </span>
  );
}
