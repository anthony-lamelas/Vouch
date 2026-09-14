import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRequests, useRoles } from '../api/queries';
import type { RoleSummary } from '../api/types';
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState';
import { GroupBand } from '../components/GroupBand';
import { PageHeader } from '../components/PageHeader';
import { Tabs } from '../components/Tabs';
import { formatCount } from '../lib/format';
import { computeNeedsYou } from '../lib/needsYou';

/** Compact band: 3px amber rule, one 32px line per item, cobalt links. */
function NeedsYou() {
  const mine = useRequests({ mine: true, active_only: true });
  const items = useMemo(() => computeNeedsYou(mine.data?.items ?? []), [mine.data]);
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Needs you"
      className="mt-4 flex rounded-r-[8px] border-l-[3px] border-needs-rule bg-needs-bg text-[13px] font-medium text-needs-text"
    >
      <span className="flex h-8 shrink-0 items-center pl-3 pr-4 font-semibold">Needs you</span>
      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 pr-3">
        {items.map((item) => (
          <li key={item.key} className="flex h-8 items-center whitespace-nowrap">
            {item.lead}&nbsp;
            <Link to={item.to} className="link">
              {item.action}
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search roles"
          aria-label="Search roles"
          className="field h-8 w-[240px] text-[13px]"
        />
      </PageHeader>

      <NeedsYou />

      <div className="mt-4">
        {roles.isPending ? <TableSkeleton rows={10} cols={6} /> : null}
        {roles.isError ? <ErrorState title="Couldn't load roles" error={roles.error} /> : null}
        {roles.data && filtered.length === 0 ? (
          <EmptyState>
            {q ? (
              <>
                No roles match “{q}”.{' '}
                <button type="button" className="link" onClick={() => setQ('')}>
                  Clear the search
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
                <th className="w-[34%]">Role</th>
                <th>Team</th>
                <th>Location</th>
                <th>Owner</th>
                <th className="num">Strong matches</th>
                <th className="num">Open requests</th>
              </tr>
            </thead>
            {groups.map(([dept, list]) => (
              <tbody key={dept} aria-label={dept}>
                <GroupBand title={dept} count={list.length} colSpan={6} />
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
                    <td className="text-carbon">
                      {r.is_mine ? (
                        <span className="text-cobalt">You</span>
                      ) : (
                        (r.owner_name ?? <span className="text-caption">—</span>)
                      )}
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
