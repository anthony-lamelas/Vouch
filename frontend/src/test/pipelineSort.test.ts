import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SORT,
  nextSort,
  parseSort,
  sortRequests,
  writeSort,
  type SortState,
} from '../lib/pipelineSort';
import { contact, employee, makeRequest } from './fixtures';

const at = (day: number) => `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`;

const zoe = makeRequest('requested', {
  id: 'zoe',
  contact: { ...contact, full_name: 'zoe Adler' },
  employee: { ...employee, full_name: 'Bob Rivera' },
  requested_by_name: 'Mia',
  last_event_at: at(5),
});
const amy = makeRequest('closed', {
  id: 'amy',
  contact: { ...contact, full_name: 'Amy Chen' },
  employee: { ...employee, full_name: 'alice Ng' },
  requested_by_name: 'Sam',
  last_event_at: at(9),
});
const amyOlder = makeRequest('candidate_interested', {
  id: 'amy-older',
  contact: { ...contact, full_name: 'amy chen' },
  employee: { ...employee, full_name: 'Carl Diaz' },
  requested_by_name: 'Mia',
  last_event_at: at(2),
});
const items = [zoe, amy, amyOlder];
const ids = (list: ReturnType<typeof sortRequests>) => list.map((r) => r.id);

describe('pipeline sort', () => {
  it('defaults to last activity, newest first, and parses only valid params', () => {
    expect(parseSort(new URLSearchParams())).toEqual(DEFAULT_SORT);
    expect(parseSort(new URLSearchParams('sort=bogus&dir=asc'))).toEqual(DEFAULT_SORT);
    expect(parseSort(new URLSearchParams('sort=candidate'))).toEqual({
      column: 'candidate',
      dir: 'asc',
    });
    expect(parseSort(new URLSearchParams('sort=activity&dir=up'))).toEqual(DEFAULT_SORT);
    expect(parseSort(new URLSearchParams('sort=status&dir=desc'))).toEqual({
      column: 'status',
      dir: 'desc',
    });
    expect(ids(sortRequests(items, DEFAULT_SORT))).toEqual(['amy', 'zoe', 'amy-older']);
    expect(ids(sortRequests(items, { column: 'activity', dir: 'asc' }))).toEqual([
      'amy-older',
      'zoe',
      'amy',
    ]);
  });

  it('sorts text columns alphabetically ignoring case, breaking ties by newest activity', () => {
    const byCandidate: SortState = { column: 'candidate', dir: 'asc' };
    // "Amy Chen" and "amy chen" tie; the newer one (day 9) comes first.
    expect(ids(sortRequests(items, byCandidate))).toEqual(['amy', 'amy-older', 'zoe']);
    expect(ids(sortRequests(items, { column: 'candidate', dir: 'desc' }))).toEqual([
      'zoe',
      'amy',
      'amy-older',
    ]);
    expect(ids(sortRequests(items, { column: 'employee', dir: 'asc' }))).toEqual([
      'amy',
      'zoe',
      'amy-older',
    ]);
    // Status sorts by its label: "Candidate interested" < "Closed" < "Waiting on employee".
    expect(ids(sortRequests(items, { column: 'status', dir: 'asc' }))).toEqual([
      'amy-older',
      'amy',
      'zoe',
    ]);
    // Requested by: two "Mia" rows tie, newest (zoe, day 5) before amy-older (day 2).
    expect(ids(sortRequests(items, { column: 'requested_by', dir: 'asc' }))).toEqual([
      'zoe',
      'amy-older',
      'amy',
    ]);
    expect(items.map((r) => r.id)).toEqual(['zoe', 'amy', 'amy-older']);
  });

  it('flips direction on the active column and starts others in their default', () => {
    const first = nextSort(DEFAULT_SORT, 'candidate');
    expect(first).toEqual({ column: 'candidate', dir: 'asc' });
    expect(nextSort(first, 'candidate')).toEqual({ column: 'candidate', dir: 'desc' });
    expect(nextSort(first, 'activity')).toEqual({ column: 'activity', dir: 'desc' });
    expect(nextSort(DEFAULT_SORT, 'activity')).toEqual({ column: 'activity', dir: 'asc' });
  });

  it('writes sort params only when they differ from the default', () => {
    const p = new URLSearchParams('scope=mine&status=requested');
    expect(writeSort(p, DEFAULT_SORT).toString()).toBe('scope=mine&status=requested');
    expect(writeSort(p, { column: 'employee', dir: 'desc' }).toString()).toBe(
      'scope=mine&status=requested&sort=employee&dir=desc',
    );
    expect(writeSort(p, DEFAULT_SORT).has('sort')).toBe(false);
  });
});
