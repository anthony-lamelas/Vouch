import { useId, useState, type ReactNode } from 'react';

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink rounded"
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
        <div id={id} className="mt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
