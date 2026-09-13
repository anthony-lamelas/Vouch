import { formatPercent } from '../lib/format';

/** Compact 0–1 score: a short track plus the number. Ink, not accent, so it never competes with actions. */
export function ScoreBar({
  value,
  label = 'Match score',
  width = 56,
}: {
  value: number;
  label?: string;
  width?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = formatPercent(clamped);
  return (
    <span className="inline-flex items-center gap-2 tnum" title={`${label}: ${pct}`}>
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        className="h-1.5 rounded-sm bg-line overflow-hidden"
        style={{ width }}
      >
        <span
          data-testid="score-fill"
          className="block h-full bg-ink-2 rounded-sm"
          style={{ width: `${clamped * 100}%` }}
        />
      </span>
      <span className="font-medium text-ink min-w-[3ch] text-right">{pct}</span>
    </span>
  );
}
