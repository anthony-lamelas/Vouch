import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreBar } from '../components/ScoreBar';

describe('ScoreBar', () => {
  it('shows the score as a percentage and sizes the fill to match', () => {
    render(<ScoreBar value={0.835} />);
    expect(screen.getByText('84%')).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '84');
    expect(screen.getByTestId('score-fill')).toHaveStyle({ width: '83.5%' });
  });

  it('clamps out-of-range values', () => {
    render(<ScoreBar value={1.4} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByTestId('score-fill')).toHaveStyle({ width: '100%' });
  });
});
