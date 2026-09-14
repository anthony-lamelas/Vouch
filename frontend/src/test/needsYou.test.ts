import { describe, expect, it } from 'vitest';
import { computeNeedsYou } from '../lib/needsYou';
import { makeRequest } from './fixtures';

describe('needs-you strip', () => {
  it('links a single quiet request straight to its page, naming the employee', () => {
    const items = computeNeedsYou([
      makeRequest('employee_accepted', { id: 'q1', stale: true, days_waiting: 10 }),
      makeRequest('candidate_interested'),
      makeRequest('candidate_interested'),
      makeRequest('requested'),
      makeRequest('closed'),
    ]);
    expect(items.map((i) => `${i.lead} ${i.action}`)).toEqual([
      '2 candidates said yes, close them',
      '1 request has gone quiet, nudge Bob',
      '1 ask is still waiting on an employee, see it',
    ]);
    expect(items[0]?.to).toBe('/pipeline?scope=mine&status=candidate_interested');
    expect(items[1]?.to).toBe('/requests/q1');
    expect(items[2]?.to).toBe('/pipeline?scope=mine&status=requested');
  });

  it('sends several quiet requests to the pipeline and is empty with nothing active', () => {
    const items = computeNeedsYou([
      makeRequest('employee_accepted', { stale: true }),
      makeRequest('employee_accepted', { stale: true }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: 'stale', count: 2, action: 'nudge them' });
    expect(items[0]?.to).toMatch(/^\/pipeline\?/);
    expect(computeNeedsYou([makeRequest('closed'), makeRequest('employee_accepted')])).toEqual([]);
  });
});
