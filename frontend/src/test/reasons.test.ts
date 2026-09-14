import { describe, expect, it } from 'vitest';
import { whyLine } from '../lib/reasons';

describe('why line', () => {
  it('joins the top two reasons on one line, shortened and lowercased after the first', () => {
    expect(
      whyLine([
        { label: '7 of 8 required skills: GPUs, PyTorch' },
        { label: 'Same job family' },
        { label: 'Tier 1 company' },
      ]),
    ).toBe('7 of 8 skills · same job family');
    expect(whyLine([{ label: 'Tier 1 school' }, { label: 'ML research fit' }])).toBe(
      'Tier 1 school · ML research fit',
    );
    expect(whyLine([])).toBe('');
  });
});
