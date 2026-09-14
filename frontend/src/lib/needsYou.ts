import type { RequestSummary } from '../api/types';
import { firstName } from './format';

export interface NeedsYouItem {
  key: 'interested' | 'declined' | 'stale' | 'waiting';
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
  const declined = active.filter((r) => r.status === 'employee_declined');
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

  const [declinedOne] = declined;
  if (declined.length === 1 && declinedOne) {
    items.push({
      key: 'declined',
      count: 1,
      lead: `${firstName(declinedOne.employee.full_name)} passed on ${firstName(declinedOne.contact.full_name)},`,
      action: 'decide what to do',
      to: `/requests/${declinedOne.id}`,
    });
  } else if (declined.length > 1) {
    items.push({
      key: 'declined',
      count: declined.length,
      lead: `${declined.length} employees passed,`,
      action: 'decide what to do',
      to: '/pipeline?scope=mine&status=employee_declined',
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

/** How many requests need a recruiter decision: a yes to close, silence, or an employee who passed. */
export function needsYouCount(requests: RequestSummary[]): number {
  return requests.filter(
    (r) =>
      r.status !== 'closed' &&
      (r.stale || r.status === 'candidate_interested' || r.status === 'employee_declined'),
  ).length;
}

export interface SidebarItem {
  key: string;
  label: string;
  to: string;
}

/**
 * Short, per-request links for the sidebar: "Close Victoria's request", "Nudge Bob about
 * Jill", then one aggregate "n asks waiting". Capped so the sidebar stays a sidebar.
 */
export function sidebarNeedsYou(requests: RequestSummary[], max = 3): SidebarItem[] {
  const active = requests.filter((r) => r.status !== 'closed');
  const items: SidebarItem[] = [];
  for (const r of active.filter((x) => x.status === 'candidate_interested')) {
    items.push({
      key: `close:${r.id}`,
      label: `Close ${firstName(r.contact.full_name)}'s request`,
      to: `/requests/${r.id}`,
    });
  }
  for (const r of active.filter((x) => x.status === 'employee_declined')) {
    items.push({
      key: `declined:${r.id}`,
      label: `${firstName(r.employee.full_name)} passed on ${firstName(r.contact.full_name)}`,
      to: `/requests/${r.id}`,
    });
  }
  for (const r of active.filter((x) => x.stale)) {
    items.push({
      key: `nudge:${r.id}`,
      label: `Nudge ${firstName(r.employee.full_name)} about ${firstName(r.contact.full_name)}`,
      to: `/requests/${r.id}`,
    });
  }
  const waiting = active.filter((r) => r.status === 'requested' && !r.stale).length;
  if (waiting > 0) {
    items.push({
      key: 'waiting',
      label: waiting === 1 ? '1 ask waiting' : `${waiting} asks waiting`,
      to: '/pipeline?scope=mine&status=requested',
    });
  }
  return items.slice(0, max);
}
