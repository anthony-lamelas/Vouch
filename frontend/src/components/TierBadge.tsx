const TIER_CLASS: Record<number, string> = {
  1: 'border-ink text-ink',
  2: 'border-line-2 text-ink-2',
  3: 'border-line text-muted',
};

export function TierBadge({ tier, className = '' }: { tier: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-[3px] border px-1 text-[10.5px] font-semibold leading-[15px] tnum ${TIER_CLASS[tier] ?? TIER_CLASS[3]} ${className}`}
      title={`Tier ${tier}`}
    >
      T{tier}
    </span>
  );
}
