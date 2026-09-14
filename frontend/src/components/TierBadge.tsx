const TIER_CLASS: Record<number, string> = {
  1: 'border-ink text-ink',
  2: 'border-line-strong text-ink-2',
  3: 'border-line text-muted',
};

export function TierBadge({ tier, className = '' }: { tier: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-[3px] border px-1 text-[11px] font-semibold leading-[14px] tnum ${TIER_CLASS[tier] ?? TIER_CLASS[3]} ${className}`}
      title={`Tier ${tier} company`}
    >
      T{tier}
    </span>
  );
}
