import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { TierBadge } from './TierBadge';

export interface Option {
  value: string;
  tier?: number;
}

/**
 * An add-button ("+ Company") that opens a searchable checkbox list. Applied values are shown
 * elsewhere as removable chips, so the trigger itself stays quiet.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Search',
}: {
  /** Singular noun, e.g. "Company". */
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.value.toLowerCase().includes(q)) : options;
    // Selected first so it is obvious what is applied.
    return [...list].sort((a, b) => {
      const sa = selected.includes(a.value) ? 0 : 1;
      const sb = selected.includes(b.value) ? 0 : 1;
      return sa - sb;
    });
  }, [options, query, selected]);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const lower = label.toLowerCase();
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Add ${lower} filter`}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 items-center gap-1 rounded-control border px-2.5 text-[14px] transition-colors ${
          open
            ? 'border-spruce text-spruce-ink'
            : 'border-line-strong text-ink-2 hover:border-ink-2 hover:text-ink'
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {label}
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-[280px] rounded-control border border-line-strong bg-surface">
          <div className="border-b border-line p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="field h-7 w-full text-[13.5px]"
              aria-label={`Search ${lower}`}
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable
            className="max-h-[280px] overflow-auto py-1"
          >
            {visible.length === 0 ? (
              <li className="px-3 py-2 text-[13.5px] text-muted">No matches</li>
            ) : (
              visible.map((o) => {
                const checked = selected.includes(o.value);
                return (
                  <li key={o.value} role="option" aria-selected={checked}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13.5px] hover:bg-canvas">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(o.value)}
                        className="accent-spruce"
                      />
                      <span className="flex-1 truncate">{o.value}</span>
                      {o.tier !== undefined ? <TierBadge tier={o.tier} /> : null}
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
