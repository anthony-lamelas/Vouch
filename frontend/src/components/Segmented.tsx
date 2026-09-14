export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border border-line bg-surface p-0.5 text-[12.5px]"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded px-2.5 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              active ? 'bg-ground text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
