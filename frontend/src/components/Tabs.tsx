/**
 * Attio tab bar: 14px/500, inactive muted, active ink with a 2px cobalt rule that sits on the
 * header's 1px border. Counts ride in a small haze pill so the bar reads as a selector.
 */
export function Tabs<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string; count?: number }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="flex h-full items-stretch gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-2 text-[14px] font-medium transition-colors ${
              active ? 'border-cobalt text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={`rounded-tag px-1.5 text-[12px] leading-[18px] tracking-normal tnum ${
                  active ? 'bg-haze text-ink' : 'bg-haze text-muted'
                }`}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
