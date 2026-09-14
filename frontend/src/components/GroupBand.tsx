export type BandTone = 'neutral' | 'needs' | 'wait' | 'reach' | 'yes' | 'no' | 'closed';

const BAND: Record<BandTone, { row: string; dot: string }> = {
  neutral: { row: 'bg-haze text-ink', dot: 'bg-caption' },
  needs: { row: 'bg-needs-bg text-needs-text', dot: 'bg-needs-rule' },
  wait: { row: 'bg-wait-bg text-wait-text', dot: 'bg-wait-dot' },
  reach: { row: 'bg-reach-bg text-reach-text', dot: 'bg-reach-dot' },
  yes: { row: 'bg-yes-bg text-yes-text', dot: 'bg-yes-dot' },
  no: { row: 'bg-no-bg text-no-text', dot: 'bg-no-dot' },
  closed: { row: 'bg-closed-bg text-closed-text', dot: 'bg-closed-dot' },
};

/** Linear-style group header: a full-width 40px band inside the table, tinted per stage. */
export function GroupBand({
  title,
  count,
  colSpan,
  tone = 'neutral',
}: {
  title: string;
  count: number;
  colSpan: number;
  tone?: BandTone;
}) {
  const cls = BAND[tone];
  return (
    <tr>
      <th colSpan={colSpan} scope="rowgroup" className={`band ${cls.row}`}>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className={`size-2 rounded-full ${cls.dot}`} />
          {title}
          <span className="text-[16px] font-medium tnum opacity-80">{count}</span>
        </span>
      </th>
    </tr>
  );
}
