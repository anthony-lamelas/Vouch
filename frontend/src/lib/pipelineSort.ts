import type { RequestSummary } from '../api/types';
import { STATUS_LABELS } from './status';

/** Pipeline column sorting. State lives in the URL as `sort=<column>&dir=asc|desc`. */

export type SortColumn = 'candidate' | 'employee' | 'status' | 'requested_by' | 'activity';
export type SortDir = 'asc' | 'desc';

export interface SortState {
  column: SortColumn;
  dir: SortDir;
}

export const SORT_COLUMNS: readonly SortColumn[] = [
  'candidate',
  'employee',
  'status',
  'requested_by',
  'activity',
];

export function isSortColumn(value: string | null): value is SortColumn {
  return value !== null && (SORT_COLUMNS as readonly string[]).includes(value);
}

/** Text columns start A–Z; last activity starts newest first. */
export function defaultDir(column: SortColumn): SortDir {
  return column === 'activity' ? 'desc' : 'asc';
}

export const DEFAULT_SORT: SortState = { column: 'activity', dir: 'desc' };

export function parseSort(params: URLSearchParams): SortState {
  const column = params.get('sort');
  if (!isSortColumn(column)) return DEFAULT_SORT;
  const dir = params.get('dir');
  return { column, dir: dir === 'asc' || dir === 'desc' ? dir : defaultDir(column) };
}

/** Writes `sort`/`dir` only when they differ from the default, keeping URLs short. */
export function writeSort(params: URLSearchParams, sort: SortState): URLSearchParams {
  params.delete('sort');
  params.delete('dir');
  if (sort.column !== DEFAULT_SORT.column || sort.dir !== DEFAULT_SORT.dir) {
    params.set('sort', sort.column);
    params.set('dir', sort.dir);
  }
  return params;
}

/** Clicking the active column flips it; clicking another column starts it in its default. */
export function nextSort(current: SortState, column: SortColumn): SortState {
  if (current.column === column) {
    return { column, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { column, dir: defaultDir(column) };
}

export function activityAt(r: RequestSummary): number {
  return new Date(r.last_event_at ?? r.updated_at).getTime();
}

function textOf(r: RequestSummary, column: Exclude<SortColumn, 'activity'>): string {
  switch (column) {
    case 'candidate':
      return r.contact.full_name;
    case 'employee':
      return r.employee.full_name;
    case 'status':
      return STATUS_LABELS[r.status];
    case 'requested_by':
      return r.requested_by_name;
  }
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/**
 * Sorted copy. Text columns compare case-insensitively; ties (and the activity column itself)
 * fall back to last activity, newest first, so equal names keep a stable, meaningful order.
 */
export function sortRequests(items: RequestSummary[], sort: SortState): RequestSummary[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sort.column === 'activity') return sign * (activityAt(a) - activityAt(b));
    const byText = compareText(textOf(a, sort.column), textOf(b, sort.column));
    if (byText !== 0) return sign * byText;
    return activityAt(b) - activityAt(a);
  });
}
