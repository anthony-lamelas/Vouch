import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRequests } from '../api/queries';
import type { RequestSummary, Status } from '../api/types';
import { Button } from '../components/Button';
import { RemovableChip } from '../components/Chip';
import { DeliveryCheck } from '../components/DeliveryMark';
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Segmented } from '../components/Segmented';
import { StatusPill } from '../components/StatusPill';
import { formatCount, formatRelative } from '../lib/format';
import { groupRequests } from '../lib/pipelineGroups';
import { STATUS_LABELS, isStatus } from '../lib/status';

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

  const groups = useMemo(
    () => groupRequests(requests.data?.items ?? [], { hideClosed: activeOnly }),
    [requests.data, activeOnly],
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

  return (
    <div>
      <PageHeader
        title="Pipeline"
        meta={
          requests.data
            ? `${formatCount(shown)} ${shown === 1 ? 'request' : 'requests'}${
                scope === 'mine' ? ' you asked for' : ''
              }`
            : ' '
        }
      >
        <Segmented
          label="Request scope"
          value={scope}
          onChange={(next) => apply({ scope: next })}
          options={[
            { value: 'mine', label: 'My requests' },
            { value: 'all', label: 'All requests' },
          ]}
        />
        <label className="inline-flex h-8 items-center gap-2 text-[13.5px] text-ink-2">
          <input
            type="checkbox"
            className="accent-spruce"
            checked={activeOnly}
            onChange={(e) => apply({ hideClosed: e.target.checked })}
          />
          Hide closed
        </label>
      </PageHeader>

      {filtered ? (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted">
          <span>Filtered:</span>
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

      {requests.isPending ? <TableSkeleton rows={6} cols={6} /> : null}
      {requests.isError ? (
        <ErrorState title="Couldn't load requests" error={requests.error} />
      ) : null}
      {requests.data && shown === 0 ? (
        <EmptyState
          title={
            filtered || activeOnly
              ? 'Nothing matches these filters.'
              : scope === 'mine'
                ? "You haven't asked anyone yet."
                : 'No requests yet.'
          }
          action={
            filtered || activeOnly ? (
              <Button onClick={() => apply({ statuses: [], hideClosed: false, roleId: undefined })}>
                Show all requests
              </Button>
            ) : (
              <Link to="/roles" className="link">
                Open a role
              </Link>
            )
          }
        >
          {filtered || activeOnly
            ? null
            : 'Pick a candidate on a role and ask the employee who knows them.'}
        </EmptyState>
      ) : null}

      {shown > 0 ? (
        <div className="border-y border-line bg-surface">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[26%]">Candidate</th>
                <th>Employee asked</th>
                <th>Status</th>
                <th>Requested by</th>
                <th className="w-[24%]">Last message</th>
                <th className="num">Last activity</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.key} aria-label={g.title}>
                <tr>
                  <th colSpan={6} scope="rowgroup" className="group">
                    {g.title}
                    <span className="ml-2 text-[14px] font-normal text-muted tnum">
                      {g.items.length}
                    </span>
                  </th>
                </tr>
                {g.items.map((r) => (
                  <RequestRow key={r.id} r={r} onOpen={() => open(r.id)} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ) : null}
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
        <div className="name">{r.contact.full_name}</div>
        <div className="mt-0.5 truncate text-[13px] text-ink-2">{r.role.title}</div>
      </td>
      <td className="text-ink">{r.employee.full_name}</td>
      <td>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={r.status} />
          {r.stale ? (
            <span className="whitespace-nowrap text-[13px] font-medium text-ochre tnum">
              No reply · {r.days_waiting ?? 0}d
            </span>
          ) : null}
        </div>
      </td>
      <td className="text-ink-2" title={r.requested_by}>
        {r.requested_by_name}
      </td>
      <td className="max-w-[340px]">
        {r.last_message ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <DeliveryCheck delivered={r.last_message.delivered} error={r.last_message.error} />
            <span
              className="min-w-0 truncate text-[13.5px] text-ink-2"
              title={r.last_message.excerpt}
            >
              {r.last_message.excerpt}
            </span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="num whitespace-nowrap text-ink-2 tnum" title={r.last_event_at ?? r.updated_at}>
        {formatRelative(r.last_event_at ?? r.updated_at)}
      </td>
    </tr>
  );
}
