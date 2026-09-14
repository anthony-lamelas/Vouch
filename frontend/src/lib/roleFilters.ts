import type { RoleSummary } from '../api/types';

/**
 * Roles-page filters. The list is small and already loaded, so filtering and the facet
 * options are computed client-side; only the applied values live in the URL, next to `scope`.
 */

export type RoleField = 'department' | 'team' | 'location';

export const ROLE_FIELDS: readonly RoleField[] = ['department', 'team', 'location'];

export const ROLE_FIELD_LABELS: Record<RoleField, string> = {
  department: 'Department',
  team: 'Team',
  location: 'Location',
};

export type RoleFilters = Record<RoleField, string[]>;

export const EMPTY_ROLE_FILTERS: RoleFilters = { department: [], team: [], location: [] };

export function parseRoleFilters(params: URLSearchParams): RoleFilters {
  return {
    department: params.getAll('department').filter(Boolean),
    team: params.getAll('team').filter(Boolean),
    location: params.getAll('location').filter(Boolean),
  };
}

/** Rewrites only the filter keys, leaving every other param (e.g. `scope`) as it was. */
export function writeRoleFilters(params: URLSearchParams, filters: RoleFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const field of ROLE_FIELDS) {
    next.delete(field);
    for (const value of filters[field]) next.append(field, value);
  }
  return next;
}

export function toggleRoleFilter(f: RoleFilters, field: RoleField, value: string): RoleFilters {
  const current = f[field];
  const values = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...f, [field]: values };
}

export function activeRoleFilterCount(f: RoleFilters): number {
  return ROLE_FIELDS.reduce((n, field) => n + f[field].length, 0);
}

export interface FacetOption {
  value: string;
  count: number;
}

/** Distinct values per field with how many roles carry each, sorted A–Z. */
export function roleFacets(roles: RoleSummary[]): Record<RoleField, FacetOption[]> {
  const tally = (pick: (r: RoleSummary) => string): FacetOption[] => {
    const counts = new Map<string, number>();
    for (const r of roles) {
      const v = pick(r);
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  };
  return {
    department: tally((r) => r.department),
    team: tally((r) => r.team),
    location: tally((r) => r.location),
  };
}

/** Values within a field are OR-ed; fields are AND-ed. Empty fields match everything. */
export function applyRoleFilters(roles: RoleSummary[], f: RoleFilters): RoleSummary[] {
  return roles.filter((r) =>
    ROLE_FIELDS.every((field) => f[field].length === 0 || f[field].includes(r[field])),
  );
}

export interface RoleFilterChip {
  key: string;
  label: string;
  field: RoleField;
  value: string;
}

/** Applied values as removable chips, in field order: department, team, location. */
export function appliedRoleChips(f: RoleFilters): RoleFilterChip[] {
  const chips: RoleFilterChip[] = [];
  for (const field of ROLE_FIELDS) {
    for (const value of f[field])
      chips.push({ key: `${field}:${value}`, label: value, field, value });
  }
  return chips;
}
