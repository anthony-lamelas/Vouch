import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRequests } from '../api/queries';
import type { RequestSummary, Status } from '../api/types';
import { Button } from '../components/Button';
import { RemovableChip } from '../components/Chip';
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState';
import { MultiSelect, type Option } from '../components/MultiSelect';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { Tabs } from '../components/Tabs';
import { formatCount, formatRelative } from '../lib/format';
import { STATUS_LABELS, STATUS_ORDER, isStatus } from '../lib/status';

/** The six statuses in lifecycle order. */
const STATUS_OPTIONS: Option[] = STATUS_ORDER.map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}));

function activityAt(r: RequestSummary): number {
  return new Date(r.last_event_at ?? r.updated_at).getTime();
}

export function PipelinePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const selected = useMemo(() => params.getAll('status').filter(isStatus), [params]);
  const activeOnly = params.get('active_only') === '1';
  const roleId = params.get('role_id') ?? undefined;
  const scope: 'mine' | 'all' = params.get('scope') === 'all' ? 'all' : 'mine';
  const [q, setQ] = useState('');

  const requests = useRequests({
    status: selected.length ? selected : undefined,
    active_only: activeOnly || undefined,
    role_id: roleId,
    mine: scope === 'mine' || undefined,
  });

  // One flat list, newest activity first; the search narrows it client-side.
  const rows = useMemo(() => {
    const items = requests.data?.items ?? [];
    const needle = q.trim().toLowerCase();
    const list = needle
      ? items.filter((r) =>
          [r.contact.full_name, r.role.title, r.employee.full_name].some((s) =>
            s.toLowerCase().includes(needle),
          ),
        )
      : items;
    return [...list].sort((a, b) => activityAt(b) - activityAt(a));
  }, [requests.data, q]);

  const apply = (next: {
    statuses?: Status[];
    hideClosed?: boolean;
    scope?: 'mine' | 'all';
    roleId?: string | undefined;
  }) => {
    const p = new URLSearchParams();
    for (const x of next.statuses ?? selected) p.append('status', x);
    if (next.hideClosed ?? activeOnly) p.set('active_only', '1');
    const rid = 'roleId' in next ? next.roleId : roleId;
    if (rid) p.set('role_id', rid);
    p.set('scope', next.scope ?? scope);
    setParams(p, { replace: true });
  };

  const filtered = selected.length > 0 || Boolean(roleId);
  const open = (id: string) => navigate(`/requests/${id}`);
  const total = requests.data?.total;

  return (
    <div>
      <PageHeader
        title="Pipeline"
        tabs={
          <Tabs
            label="Request scope"
            value={scope}
            onChange={(next) => apply({ scope: next })}
            options={[
              { value: 'mine', label: 'My requests', count: scope === 'mine' ? total : undefined },
              { value: 'all', label: 'All requests', count: scope === 'all' ? total : undefined },
            ]}
          />
        }
      >
        <label className="inline-flex h-8 items-center gap-2 text-[13px] text-carbon">
          <input
            type="checkbox"
            className="accent-cobalt"
            checked={activeOnly}
            onChange={(e) => apply({ hideClosed: e.target.checked })}
          />
          Hide closed
        </label>
      </PageHeader>

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Request filters">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search candidate, role or employee"
          aria-label="Search requests"
          className="field h-8 w-[240px] text-[13px]"
        />
        <MultiSelect
          label="Status"
          options={STATUS_OPTIONS}
          selected={selected}
          onChange={(values) => apply({ statuses: values.filter(isStatus) })}
        />
        {filtered ? (
          <>
            <span aria-hidden className="mx-1 h-4 w-px bg-line" />
            {selected.map((s) => (
              <RemovableChip
                key={s}
                label={STATUS_LABELS[s]}
                onRemove={() => apply({ statuses: selected.filter((x) => x !== s) })}
              />
            ))}
            {roleId ? (
              <RemovableChip label="One role" onRemove={() => apply({ roleId: undefined })} />
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[12px]"
              onClick={() => apply({ statuses: [], roleId: undefined })}
            >
              Clear all
            </Button>
          </>
        ) : null}
        <p className="ml-auto text-[12px] text-muted tnum" aria-live="polite">
          {requests.data
            ? `${formatCount(rows.length)} ${rows.length === 1 ? 'request' : 'requests'}`
            : ' '}
        </p>
      </div>

      <div className="mt-3">
        {requests.isPending ? <TableSkeleton rows={6} cols={5} /> : null}
        {requests.isError ? (
          <ErrorState title="Couldn't load requests" error={requests.error} />
        ) : null}
        {requests.data && rows.length === 0 ? (
          <EmptyState>
            {filtered || activeOnly || q ? (
              <>
                Nothing matches these filters.{' '}
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setQ('');
                    apply({ statuses: [], hideClosed: false, roleId: undefined });
                  }}
                >
                  Show all requests
                </button>
              </>
            ) : (
              <>
                {scope === 'mine' ? "You haven't asked anyone yet." : 'No requests yet.'} Pick a
                candidate on a role and ask the employee who knows them.{' '}
                <Link to="/roles" className="link">
                  Open a role
                </Link>
              </>
            )}
          </EmptyState>
        ) : null}

        {rows.length > 0 ? (
          <table className="data-table data-table-calm">
            <thead>
              <tr>
                <th className="w-[30%]">Candidate</th>
                <th>Employee asked</th>
                <th>Status</th>
                <th>Requested by</th>
                <th className="num">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RequestRow key={r.id} r={r} onOpen={() => open(r.id)} />
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}

function RequestRow({ r, onOpen }: { r: RequestSummary; onOpen: () => void }) {
  return (
    <tr
      tabIndex={0}
      className={`is-clickable ${r.stale ? 'is-stale' : ''}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <td>
        <div className="font-medium leading-5 text-ink">{r.contact.full_name}</div>
        <div className="truncate text-[12px] leading-4 tracking-normal text-muted">
          {r.role.title}
        </div>
      </td>
      <td className="text-carbon">{r.employee.full_name}</td>
      <td>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={r.status} />
          {r.stale ? (
            <span className="whitespace-nowrap text-[12px] font-medium tracking-normal text-needs-text tnum">
              No reply · {r.days_waiting ?? 0}d
            </span>
          ) : null}
        </div>
      </td>
      <td className="text-carbon" title={r.requested_by}>
        {r.requested_by_name}
      </td>
      <td className="num whitespace-nowrap text-muted tnum" title={r.last_event_at ?? r.updated_at}>
        {formatRelative(r.last_event_at ?? r.updated_at)}
      </td>
    </tr>
  );
}
