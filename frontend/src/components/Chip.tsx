import type { ReactNode } from 'react';
import { chipClass } from '../lib/classes';
import { XIcon } from './Icons';

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
  return (
    <span title={title} className={`${chipClass(tone === 'accent')} ${className}`}>
      <span className="truncate">{children}</span>
    </span>
  );
}

/** An applied filter: the value plus a remove control. */
export function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 max-w-full items-center rounded-tag border border-line bg-canvas pl-2 text-[12px] font-medium tracking-normal text-ink">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="ml-0.5 inline-flex h-full w-6 items-center justify-center rounded-r-tag text-muted hover:bg-haze hover:text-ink"
      >
        <XIcon size={10} />
      </button>
    </span>
  );
}
