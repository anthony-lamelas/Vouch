/** Stage colours shared by group bands and the pipeline summary strip. */

export type BandTone = 'neutral' | 'needs' | 'wait' | 'reach' | 'yes' | 'no' | 'closed';

export interface BandClasses {
  /** Full tint: background + text, for the large band. */
  row: string;
  text: string;
  dot: string;
  /** CSS variable holding the stage's dot colour, for the 3px rule. */
  rule: string;
}

export const BAND: Record<BandTone, BandClasses> = {
  neutral: {
    row: 'bg-haze text-ink',
    text: 'text-ink',
    dot: 'bg-caption',
    rule: '--color-caption',
  },
  needs: {
    row: 'bg-needs-bg text-needs-text',
    text: 'text-needs-text',
    dot: 'bg-needs-rule',
    rule: '--color-needs-rule',
  },
  wait: {
    row: 'bg-wait-bg text-wait-text',
    text: 'text-wait-text',
    dot: 'bg-wait-dot',
    rule: '--color-wait-dot',
  },
  reach: {
    row: 'bg-reach-bg text-reach-text',
    text: 'text-reach-text',
    dot: 'bg-reach-dot',
    rule: '--color-reach-dot',
  },
  yes: {
    row: 'bg-yes-bg text-yes-text',
    text: 'text-yes-text',
    dot: 'bg-yes-dot',
    rule: '--color-yes-dot',
  },
  no: {
    row: 'bg-no-bg text-no-text',
    text: 'text-no-text',
    dot: 'bg-no-dot',
    rule: '--color-no-dot',
  },
  closed: {
    row: 'bg-closed-bg text-closed-text',
    text: 'text-closed-text',
    dot: 'bg-closed-dot',
    rule: '--color-closed-dot',
  },
};
