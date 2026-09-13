import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { TierBadge } from './TierBadge';

export interface Option {
  value: string;
  tier?: number;
}

/** Hand-rolled multi-select: a button that opens a searchable checkbox list. */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Search…',
}: {
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

  const active = selected.length > 0;
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`field inline-flex items-center gap-1.5 pr-2 text-[13px] ${
          active ? 'border-accent text-accent-ink bg-accent-soft/60' : 'text-ink-2'
        }`}
      >
        <span>{label}</span>
        {active ? (
          <span className="rounded-sm bg-accent px-1 text-[11px] font-semibold text-white tnum">
            {selected.length}
          </span>
        ) : null}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="ml-0.5">
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-[280px] rounded bg-surface shadow-pop">
          <div className="p-2 border-b border-line">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="field w-full h-7 text-[12.5px]"
              aria-label={`Search ${label.toLowerCase()}`}
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable
            className="max-h-[280px] overflow-auto py-1"
          >
            {visible.length === 0 ? (
              <li className="px-3 py-2 text-muted text-[12.5px]">No matches</li>
            ) : (
              visible.map((o) => {
                const checked = selected.includes(o.value);
                return (
                  <li key={o.value} role="option" aria-selected={checked}>
                    <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-ground cursor-pointer text-[12.5px]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(o.value)}
                        className="accent-accent"
                      />
                      <span className="flex-1 truncate">{o.value}</span>
                      {o.tier !== undefined ? <TierBadge tier={o.tier} /> : null}
                    </label>
                  </li>
                );
              })
            )}
          </ul>
          {active ? (
            <div className="border-t border-line p-1.5 flex justify-end">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[12px] text-muted hover:text-ink px-2 py-1 rounded"
              >
                Clear {label.toLowerCase()}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
