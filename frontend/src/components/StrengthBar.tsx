/**
 * Connection strength as a thin 48px track. No number: the bar is a relative cue, and the
 * shared-history sentence next to it carries the real explanation.
 */
export function StrengthBar({
  value,
  label = 'Connection strength',
  width = 48,
  className = '',
}: {
  value: number;
  label?: string;
  width?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      className={`inline-block h-[3px] shrink-0 overflow-hidden rounded-[1px] bg-line align-middle ${className}`}
      style={{ width }}
    >
      <span
        data-testid="strength-fill"
        className="block h-full bg-spruce"
        style={{ width: `${clamped * 100}%` }}
      />
    </span>
  );
}
