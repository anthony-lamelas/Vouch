import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRequests, useRoles } from '../api/queries';
import type { RoleSummary } from '../api/types';
import { Button } from '../components/Button';
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { plural } from '../lib/format';
import { computeNeedsYou } from '../lib/needsYou';

function NeedsYou() {
  const mine = useRequests({ mine: true, active_only: true });
  const items = useMemo(() => computeNeedsYou(mine.data?.items ?? []), [mine.data]);
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="needs-you"
      className="mb-6 border-l-2 border-ochre bg-ochre-soft px-4 py-3"
    >
      <h2 id="needs-you" className="text-[14px] font-semibold text-ochre">
        Needs you
      </h2>
      <ul className="mt-1 space-y-0.5 text-[14px] text-ink">
        {items.map((item) => (
          <li key={item.key}>
            {item.lead}{' '}
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
      <NeedsYou />
      <PageHeader title="Roles">
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
          placeholder="Search roles"
          aria-label="Search roles"
          className="field w-[260px]"
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
                ? 'No roles are assigned to you.'
                : 'No open roles'
          }
          action={
            q ? (
              <Button onClick={() => setQ('')}>Clear the search</Button>
            ) : scope === 'mine' ? (
              <Button onClick={() => setScope('all')}>Show all roles</Button>
            ) : undefined
          }
        >
          {q ? 'Try a different word.' : scope === 'mine' ? null : 'Roles sync from Ashby.'}
        </EmptyState>
      ) : null}

      {groups.length > 0 ? (
        <div className="border-y border-line bg-surface">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[36%]">Role</th>
                <th>Team</th>
                <th>Location</th>
                <th>Owner</th>
                <th className="num">Strong matches</th>
                <th className="num">Open requests</th>
              </tr>
            </thead>
            {groups.map(([dept, list]) => (
              <tbody key={dept} aria-label={dept}>
                <tr>
                  <th colSpan={6} scope="rowgroup" className="group">
                    {dept}
                    <span className="ml-2 text-[14px] font-normal text-muted tnum">
                      {list.length}
                    </span>
                  </th>
                </tr>
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
                    <td>
                      <span className="name">{r.title}</span>
                    </td>
                    <td className="text-ink-2">{r.team}</td>
                    <td className="text-ink-2">
                      {r.location}
                      {r.is_remote ? <span className="ml-1.5 text-muted">Remote</span> : null}
                    </td>
                    <td className="text-ink-2">
                      {r.is_mine ? 'you' : (r.owner_name ?? <span className="text-muted">—</span>)}
                    </td>
                    <td className="num tnum text-ink-2">
                      {r.strong_match_count > 0 ? (
                        plural(r.strong_match_count, 'strong match', 'strong matches')
                      ) : (
                        <span className="text-muted">none yet</span>
                      )}
                    </td>
                    <td className="num tnum">
                      {r.active_request_count > 0 ? (
                        <span className="font-medium text-spruce-ink">
                          {r.active_request_count}
                        </span>
                      ) : (
                        <span className="text-muted">0</span>
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
