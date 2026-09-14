import { describe, expect, it } from 'vitest';
import { computeNeedsYou, needsYouCount, sidebarNeedsYou } from '../lib/needsYou';
import { contact, makeRequest } from './fixtures';

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

describe('sidebar needs-you links', () => {
  it('names the person per request, aggregates plain waiting, and caps at three', () => {
    const requests = [
      makeRequest('candidate_interested', {
        id: 'yes',
        contact: { ...contact, full_name: 'Victoria Lane' },
      }),
      makeRequest('employee_accepted', {
        id: 'quiet',
        stale: true,
        contact: { ...contact, full_name: 'Jill James' },
      }),
      makeRequest('requested'),
      makeRequest('requested'),
      makeRequest('closed'),
    ];
    expect(sidebarNeedsYou(requests).map((i) => [i.label, i.to])).toEqual([
      ["Close Victoria's request", '/requests/yes'],
      ['Nudge Bob about Jill', '/requests/quiet'],
      ['2 asks waiting', '/pipeline?scope=mine&status=requested'],
    ]);
    expect(needsYouCount(requests)).toBe(2);
    expect(sidebarNeedsYou([...requests, makeRequest('candidate_interested')])).toHaveLength(3);
  });

  it('is empty when nothing needs the recruiter', () => {
    expect(sidebarNeedsYou([makeRequest('closed'), makeRequest('employee_accepted')])).toEqual([]);
    expect(needsYouCount([makeRequest('employee_accepted')])).toBe(0);
  });
});

describe('employees who passed', () => {
  it('asks the recruiter to decide, counting them as needing attention', () => {
    const passed = makeRequest('employee_declined', { id: 'd1' });
    const items = computeNeedsYou([passed, makeRequest('requested')]);
    expect(items[0]).toMatchObject({ key: 'declined', action: 'decide what to do' });
    expect(items[0]?.lead).toMatch(/passed on/);
    expect(items[0]?.to).toBe('/requests/d1');
    expect(needsYouCount([passed])).toBe(1);
    expect(sidebarNeedsYou([passed])[0]?.label).toMatch(/passed on/);
  });
});
