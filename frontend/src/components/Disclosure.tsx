import { useId, useState, type ReactNode } from 'react';
import { ChevronIcon } from './Icons';

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className = '',
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-[4px] text-[13px] font-semibold text-ink hover:text-cobalt"
      >
        <ChevronIcon
          size={10}
          className={`text-caption transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {summary}
      </button>
      {open ? (
        <div id={id} className="mt-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
