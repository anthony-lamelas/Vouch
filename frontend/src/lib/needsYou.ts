import type { RequestSummary } from '../api/types';
import { firstName } from './format';

export interface NeedsYouItem {
  key: 'interested' | 'stale' | 'waiting';
  count: number;
  /** The sentence up to the action, e.g. "2 candidates said yes,". */
  lead: string;
  /** The linked verb phrase, e.g. "close them". */
  action: string;
  to: string;
}

/**
 * What the recruiter should look at first, computed from their active requests.
 * Order is by urgency: answers waiting on a close, then silence, then ordinary waiting.
 */
export function computeNeedsYou(requests: RequestSummary[]): NeedsYouItem[] {
  const active = requests.filter((r) => r.status !== 'closed');
  const interested = active.filter((r) => r.status === 'candidate_interested');
  const stale = active.filter((r) => r.stale);
  const waiting = active.filter((r) => r.status === 'requested' && !r.stale);
  const items: NeedsYouItem[] = [];

  if (interested.length > 0) {
    const n = interested.length;
    items.push({
      key: 'interested',
      count: n,
      lead: n === 1 ? '1 candidate said yes,' : `${n} candidates said yes,`,
      action: n === 1 ? 'close it' : 'close them',
      to: '/pipeline?scope=mine&status=candidate_interested',
    });
  }

  const [only] = stale;
  if (stale.length === 1 && only) {
    items.push({
      key: 'stale',
      count: 1,
      lead: '1 request has gone quiet,',
      action: `nudge ${firstName(only.employee.full_name)}`,
      to: `/requests/${only.id}`,
    });
  } else if (stale.length > 1) {
    items.push({
      key: 'stale',
      count: stale.length,
      lead: `${stale.length} requests have gone quiet,`,
      action: 'nudge them',
      to: '/pipeline?scope=mine&active_only=1',
    });
  }

  if (waiting.length > 0) {
    const n = waiting.length;
    items.push({
      key: 'waiting',
      count: n,
      lead:
        n === 1 ? '1 ask is still waiting on an employee,' : `${n} asks are waiting on employees,`,
      action: n === 1 ? 'see it' : 'see them',
      to: '/pipeline?scope=mine&status=requested',
    });
  }

  return items;
}
