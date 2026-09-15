import type { RequestSummary } from '../api/types';
import { firstName } from './format';

/**
 * "Needs you" holds only things the recruiter has to decide: a candidate who said yes (book the
 * screen), an employee who passed (ask someone else or close), or an ask that has gone quiet
 * (nudge). Asks the employee simply hasn't answered yet are status, not a to-do.
 */
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

/** Per-request links for the sidebar, most decisive first; overflow collapses to "+N more". */
export function sidebarNeedsYou(requests: RequestSummary[], max = 5): SidebarItem[] {
  const active = requests.filter((r) => r.status !== 'closed');
  const items: SidebarItem[] = [];
  for (const r of active.filter((x) => x.status === 'candidate_interested')) {
    items.push({
      key: `interested:${r.id}`,
      label: `${firstName(r.contact.full_name)} is interested`,
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
  if (items.length <= max) return items;
  return [
    ...items.slice(0, max),
    { key: 'more', label: `+${items.length - max} more`, to: '/pipeline?scope=mine' },
  ];
}
