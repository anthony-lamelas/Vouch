import { describe, expect, it } from 'vitest';
import type { RoleSummary } from '../api/types';
import {
  EMPTY_ROLE_FILTERS,
  activeRoleFilterCount,
  appliedRoleChips,
  applyRoleFilters,
  parseRoleFilters,
  roleFacets,
  toggleRoleFilter,
  writeRoleFilters,
} from '../lib/roleFilters';

let seq = 0;
function role(department: string, team: string, location: string): RoleSummary {
  seq += 1;
  return {
    id: `r${seq}`,
    ashby_id: `a${seq}`,
    title: `Role ${seq}`,
    department,
    team,
    location,
    is_remote: false,
    job_family: 'engineering',
    seniority: 'senior',
    required_skills: [],
    published_at: null,
    job_url: 'https://jobs.example/r',
    owner_email: null,
    owner_name: null,
    is_mine: false,
    strong_match_count: 0,
    active_request_count: 0,
  };
}

const roles = [
  role('R&D', 'Infra', 'San Francisco'),
  role('R&D', 'Infra', 'New York'),
  role('R&D', 'Applied AI', 'San Francisco'),
  role('GTM', 'Sales', 'New York'),
];

describe('roles filters', () => {
  it('derives sorted facet options with counts from the loaded roles', () => {
    const facets = roleFacets(roles);
    expect(facets.department).toEqual([
      { value: 'GTM', count: 1 },
      { value: 'R&D', count: 3 },
    ]);
    expect(facets.team.map((o) => o.value)).toEqual(['Applied AI', 'Infra', 'Sales']);
    expect(facets.location).toEqual([
      { value: 'New York', count: 2 },
      { value: 'San Francisco', count: 2 },
    ]);
  });

  it('ORs values within a field and ANDs across fields', () => {
    const f = toggleRoleFilter(
      toggleRoleFilter(EMPTY_ROLE_FILTERS, 'department', 'R&D'),
      'location',
      'New York',
    );
    expect(applyRoleFilters(roles, f).map((r) => r.team)).toEqual(['Infra']);
    const both = toggleRoleFilter(f, 'location', 'San Francisco');
    expect(applyRoleFilters(roles, both)).toHaveLength(3);
    expect(applyRoleFilters(roles, EMPTY_ROLE_FILTERS)).toHaveLength(4);
    expect(activeRoleFilterCount(both)).toBe(3);
    expect(toggleRoleFilter(both, 'department', 'R&D').department).toEqual([]);
  });

  it('round-trips through the URL without disturbing scope, and lists chips in field order', () => {
    const params = new URLSearchParams('scope=all');
    const f = toggleRoleFilter(
      toggleRoleFilter(EMPTY_ROLE_FILTERS, 'team', 'Infra'),
      'department',
      'R&D',
    );
    const written = writeRoleFilters(params, f);
    expect(written.get('scope')).toBe('all');
    expect(written.getAll('department')).toEqual(['R&D']);
    expect(written.getAll('team')).toEqual(['Infra']);
    expect(parseRoleFilters(written)).toEqual(f);
    expect(appliedRoleChips(f).map((c) => c.label)).toEqual(['R&D', 'Infra']);
    expect(writeRoleFilters(written, EMPTY_ROLE_FILTERS).toString()).toBe('scope=all');
  });
});
