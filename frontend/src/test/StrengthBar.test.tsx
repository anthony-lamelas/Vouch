import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StrengthBar } from '../components/StrengthBar';

describe('StrengthBar', () => {
  it('exposes the value to assistive tech and sizes the fill, without printing a number', () => {
    const { container } = render(<StrengthBar value={0.835} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '84');
    expect(screen.getByTestId('strength-fill')).toHaveStyle({ width: '83.5%' });
    expect(container.textContent).toBe('');
  });

  it('clamps out-of-range values', () => {
    render(<StrengthBar value={1.4} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByTestId('strength-fill')).toHaveStyle({ width: '100%' });
  });
});
