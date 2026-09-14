import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRoles, useStats } from '../api/queries';
import type { RoleSummary } from '../api/types';
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { formatCount, plural } from '../lib/format';

function StatsStrip() {
  const stats = useStats();
  if (stats.isPending) return <Skeleton className="h-5 w-[420px]" />;
  if (stats.isError || !stats.data) return null;
  const s = stats.data;
  const items: [string, number][] = [
    ['contacts', s.contacts],
    ['employees', s.employees],
    ['connections', s.connections],
    ['open requests', s.requests_active],
    ['roles', s.roles],
  ];
  return (
    <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12.5px] text-muted tnum">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <dt className="sr-only">{label}</dt>
          <dd className="m-0 font-semibold text-ink text-[14px]">{formatCount(value)}</dd>
          <span aria-hidden>{label}</span>
        </div>
      ))}
    </dl>
  );
}

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

  const filtered = useMemo(() => {
    const list = (roles.data ?? []).filter((r) => scope === 'all' || r.is_mine);
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) =>
      [r.title, r.team, r.location, r.department].some((s) => s.toLowerCase().includes(needle)),
    );
  }, [roles.data, q, scope]);

  const groups = useMemo(() => groupByDepartment(filtered), [filtered]);

  return (
    <div>
      <PageHeader title="Open roles" subtitle={<StatsStrip />}>
        <Segmented
          label="Role scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'mine', label: `My roles${roles.data ? ` · ${String(mineCount)}` : ''}` },
            {
              value: 'all',
              label: `All roles${roles.data ? ` · ${String(roles.data.length)}` : ''}`,
            },
          ]}
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search roles, teams, locations"
          aria-label="Search roles"
          className="field w-[300px]"
        />
      </PageHeader>

      {roles.isPending ? <TableSkeleton rows={10} /> : null}
      {roles.isError ? <ErrorState title="Couldn't load roles" error={roles.error} /> : null}
      {roles.data && filtered.length === 0 ? (
        <EmptyState
          title={
            q
              ? `No roles match “${q}”`
              : scope === 'mine'
                ? 'No roles assigned to you'
                : 'No open roles'
          }
        >
          {q ? (
            'Try a different word, or clear the search.'
          ) : scope === 'mine' ? (
            <button type="button" className="link" onClick={() => setScope('all')}>
              Show all roles
            </button>
          ) : (
            'Roles sync from the Ashby job board.'
          )}
        </EmptyState>
      ) : null}

      {groups.length > 0 ? (
        <div className="rounded-md border border-line bg-surface overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[38%]">Role</th>
                <th>Team</th>
                <th>Location</th>
                <th>Owner</th>
                <th className="num">Strong matches</th>
                <th className="num">Active requests</th>
              </tr>
            </thead>
            {groups.map(([dept, list]) => (
              <tbody key={dept}>
                <tr>
                  <th
                    colSpan={6}
                    scope="rowgroup"
                    className="sticky top-[33px] z-[1] bg-ground text-left px-3 py-1.5 text-[12px] font-semibold text-ink-2 border-b border-line"
                  >
                    {dept}
                    <span className="ml-2 font-normal text-muted tnum">{list.length}</span>
                  </th>
                </tr>
                {list.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    className="is-clickable"
                    onClick={() => navigate(`/roles/${r.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/roles/${r.id}`);
                      }
                    }}
                  >
                    <td>
                      <span className="font-medium text-ink">{r.title}</span>
                    </td>
                    <td className="text-ink-2">{r.team}</td>
                    <td className="text-ink-2">
                      {r.location}
                      {r.is_remote ? (
                        <span className="ml-1.5 text-muted text-[12px]">Remote</span>
                      ) : null}
                    </td>
                    <td className="text-ink-2">
                      {r.is_mine ? (
                        <span className="font-medium text-ink">You</span>
                      ) : (
                        (r.owner_name ?? <span className="text-faint">Unassigned</span>)
                      )}
                    </td>
                    <td className="num tnum">
                      {r.strong_match_count > 0 ? (
                        plural(r.strong_match_count, 'strong match', 'strong matches')
                      ) : (
                        <span className="text-faint">none yet</span>
                      )}
                    </td>
                    <td className="num tnum">
                      {r.active_request_count > 0 ? (
                        <span className="font-medium text-accent-ink">
                          {r.active_request_count}
                        </span>
                      ) : (
                        <span className="text-faint">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ) : null}
    </div>
  );
}
