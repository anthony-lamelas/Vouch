import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRequests } from '../api/queries';
import type { RequestSummary, Status } from '../api/types';
import { RemovableChip } from '../components/Chip';
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState';
import { GroupBand } from '../components/GroupBand';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { Tabs } from '../components/Tabs';
import { BAND, type BandTone } from '../lib/bands';
import { formatRelative } from '../lib/format';
import {
  GROUP_ORDER,
  GROUP_TITLES,
  groupKeyFor,
  groupRequests,
  type GroupKey,
} from '../lib/pipelineGroups';
import { STATUS_LABELS, isStatus } from '../lib/status';

const GROUP_TONE: Record<GroupKey, BandTone> = {
  needs_you: 'needs',
  waiting: 'wait',
  reached_out: 'reach',
  answered: 'no',
  closed: 'closed',
};

const bandId = (key: GroupKey) => `stage-${key}`;

/** One soft tag per stage with its count; clicking scrolls to the band, it never filters. */
function StageStrip({ items }: { items: RequestSummary[] }) {
  const counts = useMemo(() => {
    const c = new Map<GroupKey, number>();
    for (const r of items) c.set(groupKeyFor(r), (c.get(groupKeyFor(r)) ?? 0) + 1);
    return c;
  }, [items]);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Stages">
      {GROUP_ORDER.map((key) => {
        const n = counts.get(key) ?? 0;
        const cls = BAND[GROUP_TONE[key]];
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              const el = document.getElementById(bandId(key));
              if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ block: 'start', behavior: 'smooth' });
              }
            }}
            className={`inline-flex h-[22px] items-center gap-1.5 rounded-tag px-2 text-[12px] font-medium tracking-normal transition-opacity hover:opacity-80 ${
              n > 0 ? cls.row : 'bg-haze text-caption'
            }`}
          >
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${n > 0 ? cls.dot : 'bg-caption'}`}
            />
            {GROUP_TITLES[key]}
            <span className="tnum">{n}</span>
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
  const scope: 'mine' | 'all' = params.get('scope') === 'all' ? 'all' : 'mine';

  const requests = useRequests({
    status: selected.length ? selected : undefined,
    active_only: activeOnly || undefined,
    role_id: roleId,
    mine: scope === 'mine' || undefined,
  });

  const items = requests.data?.items;
  const groups = useMemo(
    () => groupRequests(items ?? [], { hideClosed: activeOnly }),
    [items, activeOnly],
  );
  const shown = groups.reduce((n, g) => n + g.items.length, 0);

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

      {items ? <StageStrip items={items} /> : null}

      {filtered ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
          <span>Filtered</span>
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
        </div>
      ) : null}

      <div className="mt-3">
        {requests.isPending ? <TableSkeleton rows={6} cols={5} /> : null}
        {requests.isError ? (
          <ErrorState title="Couldn't load requests" error={requests.error} />
        ) : null}
        {requests.data && shown === 0 ? (
          <EmptyState>
            {filtered || activeOnly ? (
              <>
                Nothing matches these filters.{' '}
                <button
                  type="button"
                  className="link"
                  onClick={() => apply({ statuses: [], hideClosed: false, roleId: undefined })}
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

        {shown > 0 ? (
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
            {groups.map((g) => (
              <tbody key={g.key} aria-label={g.title}>
                <GroupBand
                  id={bandId(g.key)}
                  size="sm"
                  title={g.title}
                  count={g.items.length}
                  colSpan={5}
                  tone={GROUP_TONE[g.key]}
                />
                {g.items.map((r) => (
                  <RequestRow key={r.id} r={r} onOpen={() => open(r.id)} />
                ))}
              </tbody>
            ))}
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
