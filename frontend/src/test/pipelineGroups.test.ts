import { describe, expect, it } from 'vitest';
import { groupKeyFor, groupRequests } from '../lib/pipelineGroups';
import { makeRequest } from './fixtures';

describe('pipeline grouping', () => {
  const stale = makeRequest('employee_accepted', {
    id: 'stale',
    stale: true,
    days_waiting: 10,
    last_event_at: '2026-09-01T10:00:00Z',
  });
  const yes = makeRequest('candidate_interested', {
    id: 'yes',
    last_event_at: '2026-09-12T10:00:00Z',
  });
  const waiting = makeRequest('requested', { id: 'waiting' });
  const reached = makeRequest('employee_accepted', { id: 'reached' });
  const passed = makeRequest('employee_declined', { id: 'passed' });
  const closed = makeRequest('closed', { id: 'closed' });

  it('puts silence and a yes in Needs you, then follows the fixed section order', () => {
    expect(groupKeyFor(stale)).toBe('needs_you');
    expect(groupKeyFor(yes)).toBe('needs_you');
    expect(groupKeyFor(waiting)).toBe('waiting');
    expect(groupKeyFor(reached)).toBe('reached_out');
    expect(groupKeyFor(passed)).toBe('answered');
    expect(groupKeyFor(closed)).toBe('closed');

    const groups = groupRequests([closed, passed, reached, waiting, yes, stale]);
    expect(groups.map((g) => g.title)).toEqual([
      'Needs you',
      'Waiting on employee',
      'Employee reached out',
      'Answered',
      'Closed',
    ]);
    // Stale first inside Needs you even though the yes has newer activity.
    expect(groups[0]?.items.map((r) => r.id)).toEqual(['stale', 'yes']);
  });

  it('drops empty sections and hides Closed on request', () => {
    const groups = groupRequests([closed, yes], { hideClosed: true });
    expect(groups.map((g) => g.key)).toEqual(['needs_you']);
    expect(groupRequests([], { hideClosed: false })).toEqual([]);
  });
});
