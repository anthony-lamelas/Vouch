import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRequests } from '../api/queries';
import type { RequestSummary, Status } from '../api/types';
import { Button } from '../components/Button';
import { RemovableChip } from '../components/Chip';
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState';
import { ChevronIcon } from '../components/Icons';
import { MultiSelect, type Option } from '../components/MultiSelect';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { Tabs } from '../components/Tabs';
import { formatCount, formatRelative } from '../lib/format';
import {
  nextSort,
  parseSort,
  sortRequests,
  writeSort,
  type SortColumn,
  type SortState,
} from '../lib/pipelineSort';
import { STATUS_LABELS, STATUS_ORDER, isStatus } from '../lib/status';

/** The six statuses in lifecycle order. */
const STATUS_OPTIONS: Option[] = STATUS_ORDER.map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}));

const COLUMNS: readonly { key: SortColumn; label: string; className?: string }[] = [
  { key: 'candidate', label: 'Candidate', className: 'w-[30%]' },
  { key: 'employee', label: 'Employee asked' },
  { key: 'status', label: 'Status' },
  { key: 'requested_by', label: 'Requested by' },
  { key: 'activity', label: 'Last activity', className: 'num' },
];

/** A header cell that sorts its column; the active one shows a chevron and `aria-sort`. */
function SortHeader({
  column,
  label,
  className = '',
  sort,
  onSort,
}: {
  column: SortColumn;
  label: string;
  className?: string;
  sort: SortState;
  onSort: (column: SortColumn) => void;
}) {
  const active = sort.column === column;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex h-full items-center gap-1 rounded-[4px] ${
          active ? 'text-ink' : 'hover:text-ink'
        }`}
      >
        {label}
        {active ? (
          <ChevronIcon
            size={12}
            className={sort.dir === 'asc' ? '-rotate-90' : 'rotate-90'}
            data-testid="sort-chevron"
          />
        ) : null}
      </button>
    </th>
  );
}

export function PipelinePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const selected = useMemo(() => params.getAll('status').filter(isStatus), [params]);
  const activeOnly = params.get('active_only') === '1';
  const roleId = params.get('role_id') ?? undefined;
  const scope: 'mine' | 'all' = params.get('scope') === 'all' ? 'all' : 'mine';
  const sort = useMemo(() => parseSort(params), [params]);
  const [q, setQ] = useState('');

  const requests = useRequests({
    status: selected.length ? selected : undefined,
    active_only: activeOnly || undefined,
    role_id: roleId,
    mine: scope === 'mine' || undefined,
  });

  // One flat list; the search narrows it client-side and the chosen column orders it.
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
    return sortRequests(list, sort);
  }, [requests.data, q, sort]);

  const apply = (next: {
    statuses?: Status[];
    hideClosed?: boolean;
    scope?: 'mine' | 'all';
    roleId?: string | undefined;
    sort?: SortState;
  }) => {
    const p = new URLSearchParams();
    for (const x of next.statuses ?? selected) p.append('status', x);
    if (next.hideClosed ?? activeOnly) p.set('active_only', '1');
    const rid = 'roleId' in next ? next.roleId : roleId;
    if (rid) p.set('role_id', rid);
    p.set('scope', next.scope ?? scope);
    // Sorting survives every other change, including "Clear all".
    setParams(writeSort(p, next.sort ?? sort), { replace: true });
  };
  const onSort = (column: SortColumn) => apply({ sort: nextSort(sort, column) });

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
                {COLUMNS.map((c) => (
                  <SortHeader
                    key={c.key}
                    column={c.key}
                    label={c.label}
                    className={c.className}
                    sort={sort}
                    onSort={onSort}
                  />
                ))}
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
