import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRequests, useStats } from '../api/queries';
import type { Status } from '../api/types';
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { formatCount, formatRelative } from '../lib/format';
import { STATUS_LABELS, STATUS_ORDER, isStatus } from '../lib/status';

function Funnel({
  selected,
  onSelect,
}: {
  selected: Status[];
  onSelect: (s: Status | null) => void;
}) {
  const stats = useStats();
  const counts = new Map<Status, number>();
  for (const c of stats.data?.by_status ?? []) counts.set(c.status, c.count);
  const total = stats.data?.requests_total ?? 0;
  const allActive = selected.length === 0;
  const cell = (active: boolean, dim = false) =>
    `rounded border px-2.5 py-1.5 text-left transition-colors ${
      active ? 'border-ink bg-surface' : 'border-line bg-surface hover:border-line-2'
    } ${dim ? 'opacity-60' : ''}`;
  return (
    <div className="flex flex-wrap items-stretch gap-1" role="group" aria-label="Filter by status">
      <button
        type="button"
        aria-pressed={allActive}
        onClick={() => onSelect(null)}
        className={cell(allActive)}
      >
        <span className="block text-[11.5px] text-muted">All</span>
        <span className="block text-[15px] font-semibold tnum leading-tight">
          {formatCount(total)}
        </span>
      </button>
      {STATUS_ORDER.map((s) => {
        const active = selected.includes(s);
        const n = counts.get(s) ?? 0;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(s)}
            className={cell(active, n === 0 && !active)}
          >
            <span className="block text-[11.5px] text-muted whitespace-nowrap">
              {STATUS_LABELS[s]}
            </span>
            <span className="block text-[15px] font-semibold tnum leading-tight">
              {formatCount(n)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PipelinePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const selected = useMemo(() => params.getAll('status').filter(isStatus), [params]);
  const activeOnly = params.get('active_only') === '1';
  const roleId = params.get('role_id') ?? undefined;

  const requests = useRequests({
    status: selected.length ? selected : undefined,
    active_only: activeOnly || undefined,
    role_id: roleId,
  });

  const rows = useMemo(
    () =>
      [...(requests.data?.items ?? [])].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [requests.data],
  );

  const apply = (statuses: Status[], hideClosed: boolean) => {
    const next = new URLSearchParams();
    for (const x of statuses) next.append('status', x);
    if (hideClosed) next.set('active_only', '1');
    if (roleId) next.set('role_id', roleId);
    setParams(next, { replace: true });
  };

  const setStatus = (s: Status | null) => {
    if (!s) {
      apply([], activeOnly);
      return;
    }
    apply(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s], activeOnly);
  };

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle={
          requests.data
            ? `${formatCount(requests.data.total)} ${requests.data.total === 1 ? 'request' : 'requests'}${
                selected.length ? ' in the selected statuses' : ''
              }`
            : ' '
        }
      >
        <label className="inline-flex items-center gap-2 text-[12.5px] text-ink-2">
          <input
            type="checkbox"
            className="accent-accent"
            checked={activeOnly}
            onChange={(e) => apply(selected, e.target.checked)}
          />
          Hide closed
        </label>
        {roleId ? (
          <Link
            to={`/roles/${roleId}`}
            className="link text-[12.5px]"
            title="Showing one role's requests"
          >
            Filtered to one role
          </Link>
        ) : null}
      </PageHeader>

      <div className="mb-4">
        <Funnel selected={selected} onSelect={setStatus} />
      </div>

      {requests.isPending ? <TableSkeleton rows={6} cols={6} /> : null}
      {requests.isError ? (
        <ErrorState title="Couldn't load requests" error={requests.error} />
      ) : null}
      {requests.data && rows.length === 0 ? (
        <EmptyState title="No requests here">
          {selected.length || activeOnly
            ? 'Nothing matches these filters. Pick a different status or show closed requests.'
            : 'Open a role and request a referral for a candidate to start the pipeline.'}
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <div className="rounded-md border border-line bg-surface overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role</th>
                <th>Employee asked</th>
                <th>Status</th>
                <th>Requested by</th>
                <th className="num">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  tabIndex={0}
                  className="is-clickable"
                  onClick={() => navigate(`/requests/${r.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/requests/${r.id}`);
                    }
                  }}
                >
                  <td>
                    <div className="font-medium text-ink">{r.contact.full_name}</div>
                    <div className="text-[12px] text-muted truncate max-w-[260px]">
                      {r.contact.headline}
                    </div>
                  </td>
                  <td>
                    <div className="text-ink">{r.role.title}</div>
                    <div className="text-[12px] text-muted">{r.role.team}</div>
                  </td>
                  <td>
                    <div className="text-ink">{r.employee.full_name}</div>
                    <div className="text-[12px] text-muted">{r.employee.title}</div>
                  </td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td className="text-ink-2 text-[12.5px]">{r.requested_by}</td>
                  <td className="num tnum text-ink-2 whitespace-nowrap" title={r.updated_at}>
                    {formatRelative(r.last_event_at ?? r.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
