import { useId, useState, type ReactNode } from 'react';

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
        className="inline-flex items-center gap-1.5 rounded-[2px] text-[14px] font-medium text-ink-2 hover:text-ink"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        >
          <path d="M3 1.5L7 5l-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {summary}
      </button>
      {open ? (
        <div id={id} className="mt-2.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
