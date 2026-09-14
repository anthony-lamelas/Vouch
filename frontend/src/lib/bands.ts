/** Stage colours for group bands. */

export type BandTone = 'neutral' | 'needs' | 'wait' | 'reach' | 'yes' | 'no' | 'closed';

export interface BandClasses {
  /** Full tint: background + text, for the large band. */
  row: string;
  text: string;
  /** CSS variable holding the stage's accent colour, for the small band's 3px rule. */
  rule: string;
}

export const BAND: Record<BandTone, BandClasses> = {
  neutral: { row: 'bg-haze text-ink', text: 'text-ink', rule: '--color-caption' },
  needs: {
    row: 'bg-needs-bg text-needs-text',
    text: 'text-needs-text',
    rule: '--color-needs-rule',
  },
  wait: { row: 'bg-wait-bg text-wait-text', text: 'text-wait-text', rule: '--color-wait-dot' },
  reach: { row: 'bg-reach-bg text-reach-text', text: 'text-reach-text', rule: '--color-reach-dot' },
  yes: { row: 'bg-yes-bg text-yes-text', text: 'text-yes-text', rule: '--color-yes-dot' },
  no: { row: 'bg-no-bg text-no-text', text: 'text-no-text', rule: '--color-no-dot' },
  closed: {
    row: 'bg-closed-bg text-closed-text',
    text: 'text-closed-text',
    rule: '--color-closed-dot',
  },
};
