const TIER_CLASS: Record<number, string> = {
  1: 'bg-ice text-cobalt',
  2: 'bg-haze text-carbon',
  3: 'bg-haze text-muted',
};

export function TierBadge({ tier, className = '' }: { tier: number; className?: string }) {
  return (
    <span
      className={`inline-flex h-4 items-center rounded-[5px] px-1 text-[11px] font-semibold tracking-normal tnum ${TIER_CLASS[tier] ?? TIER_CLASS[3]} ${className}`}
      title={`Tier ${tier} company`}
    >
      T{tier}
    </span>
  );
}
