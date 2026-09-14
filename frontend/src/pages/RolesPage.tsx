import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRoles } from '../api/queries';
import type { RoleSummary } from '../api/types';
import { Button } from '../components/Button';
import { RemovableChip } from '../components/Chip';
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState';
import { GroupBand } from '../components/GroupBand';
import { MultiSelect } from '../components/MultiSelect';
import { PageHeader } from '../components/PageHeader';
import { Tabs } from '../components/Tabs';
import { formatCount } from '../lib/format';
import {
  EMPTY_ROLE_FILTERS,
  ROLE_FIELDS,
  ROLE_FIELD_LABELS,
  activeRoleFilterCount,
  appliedRoleChips,
  applyRoleFilters,
  parseRoleFilters,
  roleFacets,
  toggleRoleFilter,
  writeRoleFilters,
  type RoleFilters,
} from '../lib/roleFilters';

function groupByDepartment(roles: RoleSummary[]): [string, RoleSummary[]][] {
  const map = new Map<string, RoleSummary[]>();
  for (const r of roles) {
    const list = map.get(r.department) ?? [];
    list.push(r);
    map.set(r.department, list);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function RolesPage() {
  const roles = useRoles();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');

  const mineCount = useMemo(() => (roles.data ?? []).filter((r) => r.is_mine).length, [roles.data]);
  const scopeParam = params.get('scope');
  const scope: 'mine' | 'all' =
    scopeParam === 'mine' || scopeParam === 'all' ? scopeParam : mineCount > 0 ? 'mine' : 'all';
  const setScope = (next: 'mine' | 'all') => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('scope', next);
    setParams(nextParams, { replace: true });
  };

  const filters = useMemo(() => parseRoleFilters(params), [params]);
  const setFilters = (next: RoleFilters) =>
    setParams(writeRoleFilters(params, next), { replace: true });

  const inScope = useMemo(
    () => (roles.data ?? []).filter((r) => scope === 'all' || r.is_mine),
    [roles.data, scope],
  );
  const facets = useMemo(() => roleFacets(inScope), [inScope]);

  const filtered = useMemo(() => {
    const list = applyRoleFilters(inScope, filters);
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) =>
      [r.title, r.team, r.location, r.department].some((s) => s.toLowerCase().includes(needle)),
    );
  }, [inScope, filters, q]);

  const groups = useMemo(() => groupByDepartment(filtered), [filtered]);
  const chips = appliedRoleChips(filters);
  const nFilters = activeRoleFilterCount(filters);
  const open = (id: string) => navigate(`/roles/${id}`);

  return (
    <div>
      <PageHeader
        title="Roles"
        tabs={
          <Tabs
            label="Role scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'mine', label: 'My roles', count: roles.data ? mineCount : undefined },
              { value: 'all', label: 'All roles', count: roles.data?.length },
            ]}
          />
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Role filters">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search roles"
          aria-label="Search roles"
          className="field h-8 w-[240px] text-[13px]"
        />
        {ROLE_FIELDS.map((field) => (
          <MultiSelect
            key={field}
            label={ROLE_FIELD_LABELS[field]}
            options={facets[field]}
            selected={filters[field]}
            onChange={(values) => setFilters({ ...filters, [field]: values })}
          />
        ))}
        {chips.length > 0 ? (
          <>
            <span aria-hidden className="mx-1 h-4 w-px bg-line" />
            {chips.map((c) => (
              <RemovableChip
                key={c.key}
                label={c.label}
                onRemove={() => setFilters(toggleRoleFilter(filters, c.field, c.value))}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[12px]"
              onClick={() => setFilters(EMPTY_ROLE_FILTERS)}
            >
              Clear all
            </Button>
          </>
        ) : null}
        <p className="ml-auto text-[12px] text-muted tnum" aria-live="polite">
          {roles.data
            ? `${formatCount(filtered.length)} ${filtered.length === 1 ? 'role' : 'roles'}`
            : ' '}
        </p>
      </div>

      <div className="mt-3">
        {roles.isPending ? <TableSkeleton rows={10} cols={5} /> : null}
        {roles.isError ? <ErrorState title="Couldn't load roles" error={roles.error} /> : null}
        {roles.data && filtered.length === 0 ? (
          <EmptyState>
            {q || nFilters > 0 ? (
              <>
                No roles match {q ? `“${q}”` : 'these filters'}.{' '}
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setQ('');
                    setFilters(EMPTY_ROLE_FILTERS);
                  }}
                >
                  Clear all filters
                </button>
              </>
            ) : scope === 'mine' ? (
              <>
                No roles are assigned to you.{' '}
                <button type="button" className="link" onClick={() => setScope('all')}>
                  Show all roles
                </button>
              </>
            ) : (
              'No open roles. Roles sync from Ashby.'
            )}
          </EmptyState>
        ) : null}

        {groups.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[40%]">Role</th>
                <th>Team</th>
                <th>Location</th>
                <th className="num">Strong matches</th>
                <th className="num">Open requests</th>
              </tr>
            </thead>
            {groups.map(([dept, list]) => (
              <tbody key={dept} aria-label={dept}>
                <GroupBand title={dept} count={list.length} colSpan={5} />
                {list.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    className="is-clickable"
                    onClick={() => open(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open(r.id);
                      }
                    }}
                  >
                    <td className="font-medium text-ink">{r.title}</td>
                    <td className="text-carbon">{r.team}</td>
                    <td className="text-carbon">
                      {r.location}
                      {r.is_remote ? <span className="ml-1.5 text-caption">Remote</span> : null}
                    </td>
                    <td className="num text-carbon tnum">
                      {r.strong_match_count > 0 ? (
                        `${formatCount(r.strong_match_count)} ${
                          r.strong_match_count === 1 ? 'match' : 'matches'
                        }`
                      ) : (
                        <span className="text-caption">none yet</span>
                      )}
                    </td>
                    <td className="num tnum">
                      {r.active_request_count > 0 ? (
                        <span className="text-cobalt">{r.active_request_count}</span>
                      ) : (
                        <span className="text-caption">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        ) : null}
      </div>
    </div>
  );
}
