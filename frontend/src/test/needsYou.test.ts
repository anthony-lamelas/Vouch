import { describe, expect, it } from 'vitest';
import { needsYouCount, sidebarNeedsYou } from '../lib/needsYou';
import { contact, makeRequest } from './fixtures';

describe('needs-you sidebar', () => {
  it('lists only decisions: interested first, then passed, then quiet; never plain waiting', () => {
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
      makeRequest('employee_declined', { id: 'd1' }),
      makeRequest('requested'),
      makeRequest('requested'),
      makeRequest('closed'),
    ];
    expect(sidebarNeedsYou(requests).map((i) => [i.label, i.to])).toEqual([
      ['Victoria is interested', '/requests/yes'],
      [`Bob passed on ${contact.full_name.split(' ')[0]}`, '/requests/d1'],
      ['Nudge Bob about Jill', '/requests/quiet'],
    ]);
    expect(needsYouCount(requests)).toBe(3);
  });

  it('collapses overflow into a "+N more" link to the pipeline', () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      makeRequest('candidate_interested', { id: `r${i}` }),
    );
    const items = sidebarNeedsYou(many);
    expect(items).toHaveLength(6);
    expect(items[5]).toEqual({ key: 'more', label: '+2 more', to: '/pipeline?scope=mine' });
  });

  it('is empty when nothing needs the recruiter, even with asks waiting', () => {
    const quiet = [
      makeRequest('closed'),
      makeRequest('employee_accepted'),
      makeRequest('requested'),
    ];
    expect(sidebarNeedsYou(quiet)).toEqual([]);
    expect(needsYouCount(quiet)).toBe(0);
  });
});
