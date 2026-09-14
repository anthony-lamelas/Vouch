import type { RequestSummary } from '../api/types';

export type GroupKey = 'needs_you' | 'waiting' | 'reached_out' | 'answered' | 'closed';

export interface RequestGroup {
  key: GroupKey;
  title: string;
  items: RequestSummary[];
}

export const GROUP_ORDER: readonly GroupKey[] = [
  'needs_you',
  'waiting',
  'reached_out',
  'answered',
  'closed',
];

export const GROUP_TITLES: Record<GroupKey, string> = {
  needs_you: 'Needs you',
  waiting: 'Waiting on employee',
  reached_out: 'Employee reached out',
  answered: 'Answered',
  closed: 'Closed',
};

/** Which section a request belongs in. Silence and a yes both need the recruiter. */
export function groupKeyFor(r: RequestSummary): GroupKey {
  if (r.status === 'closed') return 'closed';
  if (r.stale || r.status === 'candidate_interested') return 'needs_you';
  if (r.status === 'requested') return 'waiting';
  if (r.status === 'employee_accepted') return 'reached_out';
  return 'answered';
}

function updatedAt(r: RequestSummary): number {
  return new Date(r.last_event_at ?? r.updated_at).getTime();
}

/**
 * Groups requests into the pipeline sections in display order. Empty sections are dropped,
 * and Closed is dropped entirely when `hideClosed` is set. Within a section, newest activity
 * first; in Needs you, silent requests come before answered ones.
 */
export function groupRequests(
  items: RequestSummary[],
  { hideClosed = false }: { hideClosed?: boolean } = {},
): RequestGroup[] {
  const buckets = new Map<GroupKey, RequestSummary[]>();
  for (const r of items) {
    const key = groupKeyFor(r);
    const list = buckets.get(key) ?? [];
    list.push(r);
    buckets.set(key, list);
  }
  const groups: RequestGroup[] = [];
  for (const key of GROUP_ORDER) {
    if (hideClosed && key === 'closed') continue;
    const list = buckets.get(key);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => {
      if (key === 'needs_you' && a.stale !== b.stale) return a.stale ? -1 : 1;
      return updatedAt(b) - updatedAt(a);
    });
    groups.push({ key, title: GROUP_TITLES[key], items: list });
  }
  return groups;
}
