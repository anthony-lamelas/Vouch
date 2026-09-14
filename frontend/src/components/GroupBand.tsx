import type { CSSProperties } from 'react';
import { BAND, type BandTone } from '../lib/bands';

export type { BandTone } from '../lib/bands';

/**
 * Linear-style group header inside a table: label and count only. `lg` (Roles) is a
 * full-width tinted band; `sm` is a calm 32px row on canvas with a 3px rule in the stage colour.
 */
export function GroupBand({
  title,
  count,
  colSpan,
  tone = 'neutral',
  size = 'lg',
  id,
}: {
  title: string;
  count: number;
  colSpan: number;
  tone?: BandTone;
  size?: 'lg' | 'sm';
  /** Lets a summary strip scroll to this band. */
  id?: string;
}) {
  const cls = BAND[tone];
  if (size === 'sm') {
    const style = { '--band-rule': `var(${cls.rule})` } as CSSProperties;
    return (
      <tr id={id}>
        <th colSpan={colSpan} scope="rowgroup" className={`band band-sm ${cls.text}`} style={style}>
          {title}
          <span className="ml-2 text-[13px] font-medium text-muted tnum">{count}</span>
        </th>
      </tr>
    );
  }
  return (
    <tr id={id}>
      <th colSpan={colSpan} scope="rowgroup" className={`band ${cls.row}`}>
        {title}
        <span className="ml-2 text-[16px] font-medium tnum opacity-80">{count}</span>
      </th>
    </tr>
  );
}
