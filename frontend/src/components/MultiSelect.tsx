import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterPillClass } from '../lib/classes';
import { PlusIcon } from './Icons';
import { TierBadge } from './TierBadge';

export interface Option {
  value: string;
  /** Display text when it differs from the value, e.g. "Tier 1" for value "1". */
  label?: string;
  tier?: number;
  /** How many rows carry this value; shown muted on the right. */
  count?: number;
}

/** A separately-controlled group shown above the main list, e.g. tiers before companies. */
export interface PinnedGroup {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function matches(o: Option, q: string) {
  return !q || (o.label ?? o.value).toLowerCase().includes(q) || o.value.toLowerCase().includes(q);
}

/** Linear-style filter pill: "+ Company" that opens a searchable checkbox list. */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  pinned,
  placeholder = 'Search',
}: {
  /** Singular noun, e.g. "Company". */
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  pinned?: PinnedGroup;
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

  const q = query.trim().toLowerCase();
  // Callers own the order (tier, then name, with anything pinned first).
  const visible = useMemo(() => options.filter((o) => matches(o, q)), [options, q]);
  const pinnedVisible = useMemo(
    () => (pinned ? pinned.options.filter((o) => matches(o, q)) : []),
    [pinned, q],
  );

  const toggleIn = (list: string[], value: string, emit: (v: string[]) => void) => {
    emit(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const row = (o: Option, checked: boolean, onToggle: () => void) => (
    <li key={o.value} role="option" aria-selected={checked}>
      <label className="flex h-7 cursor-pointer items-center gap-2 px-2.5 text-[13px] hover:bg-haze">
        <input type="checkbox" checked={checked} onChange={onToggle} className="accent-cobalt" />
        <span className="flex-1 truncate">{o.label ?? o.value}</span>
        {o.tier !== undefined ? <TierBadge tier={o.tier} /> : null}
        {o.count !== undefined ? (
          <span className="text-[12px] tracking-normal text-muted tnum">{o.count}</span>
        ) : null}
      </label>
    </li>
  );

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
        className={filterPillClass(open)}
      >
        <PlusIcon size={10} />
        {label}
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-[260px] overflow-hidden rounded-card border border-line bg-canvas shadow-pop">
          <div className="border-b border-line p-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="field h-7 w-full rounded-[7px] text-[13px]"
              aria-label={`Search ${lower}`}
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable
            className="max-h-[280px] overflow-auto py-1"
          >
            {pinned
              ? pinnedVisible.map((o) =>
                  row(o, pinned.selected.includes(o.value), () =>
                    toggleIn(pinned.selected, o.value, pinned.onChange),
                  ),
                )
              : null}
            {pinnedVisible.length > 0 && visible.length > 0 ? (
              <li role="presentation" aria-hidden className="my-1 border-t border-line" />
            ) : null}
            {visible.map((o) =>
              row(o, selected.includes(o.value), () => toggleIn(selected, o.value, onChange)),
            )}
            {visible.length === 0 && pinnedVisible.length === 0 ? (
              <li className="px-3 py-1.5 text-[13px] text-muted">No matches</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
