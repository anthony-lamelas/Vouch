import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPill } from '../components/StatusPill';
import { STATUS_LABELS, STATUS_ORDER } from '../lib/status';

describe('StatusPill', () => {
  it('renders the exact label for every status', () => {
    for (const status of STATUS_ORDER) {
      const { unmount } = render(<StatusPill status={status} />);
      expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument();
      unmount();
    }
    expect(STATUS_LABELS.employee_accepted).toBe('Employee reached out');
    expect(STATUS_LABELS.employee_accepted).toBe('Employee reached out');
  });

  it('uses semantic tones', () => {
    render(<StatusPill status="candidate_declined" />);
    expect(screen.getByText('Candidate passed')).toHaveAttribute('data-tone', 'negative');
    render(<StatusPill status="employee_declined" />);
    expect(screen.getByText('Employee passed')).toHaveAttribute('data-tone', 'negative');
    render(<StatusPill status="candidate_interested" />);
    expect(screen.getByText('Candidate interested')).toHaveAttribute('data-tone', 'positive');
    render(<StatusPill status="closed" />);
    expect(screen.getByText('Closed')).toHaveAttribute('data-tone', 'neutral');
  });
});
