import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCandidates, useFilterOptions, useRequests, useRole } from '../api/queries';
import type { CandidateOut, TieredName } from '../api/types';
import { Button } from '../components/Button';
import { RemovableChip } from '../components/Chip';
import { Drawer } from '../components/Drawer';
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from '../components/EmptyState';
import { ExternalIcon } from '../components/Icons';
import { MultiSelect } from '../components/MultiSelect';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { StatusPill } from '../components/StatusPill';
import { StrengthBar } from '../components/StrengthBar';
import { TierBadge } from '../components/TierBadge';
import {
  activeFilterCount,
  appliedFilterChips,
  filtersReducer,
  parseFilters,
  serializeFilters,
  type FilterAction,
} from '../lib/candidateFilters';
import { buttonClass, chipClass, filterPillClass } from '../lib/classes';
import { firstName, formatCount, titleCase } from '../lib/format';
import { whyLine } from '../lib/reasons';
import { CandidateDrawer } from './CandidateDrawer';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function RoleDetailPage() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const contactId = searchParams.get('contact');

  const role = useRole(id);
  const options = useFilterOptions();
  const candidates = useCandidates(id, filters);
  const roleRequests = useRequests({ role_id: id });

  const tierByCompany = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of options.data?.companies ?? []) m.set(c.name, c.tier);
    return m;
  }, [options.data]);

  const write = useCallback(
    (next: ReturnType<typeof parseFilters>, contact: string | null) => {
      setSearchParams(serializeFilters(next, { contact }), { replace: true });
    },
    [setSearchParams],
  );

  const dispatch = useCallback(
    (action: FilterAction) => write(filtersReducer(filters, action), contactId),
    [contactId, filters, write],
  );

  const openContact = (cid: string) => write(filters, cid);
  const closeContact = useCallback(() => write(filters, null), [filters, write]);

  // Local search box state so typing doesn't rewrite the URL on every keystroke.
  const [qInput, setQInput] = useState(filters.q);
  const debouncedQ = useDebounced(qInput, 250);
  useEffect(() => {
    if (debouncedQ !== filters.q) dispatch({ type: 'setQuery', q: debouncedQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);
  useEffect(() => {
    setQInput(filters.q);
  }, [filters.q]);

  const page = candidates.data;
  const items = page?.items ?? [];
  const nFilters = activeFilterCount(filters);
  const chips = appliedFilterChips(filters);
  const tier1Only = filters.companyTier === 1;
  const requestItems = roleRequests.data?.items ?? [];

  return (
    <div>
      {role.isError ? <ErrorState title="Couldn't load this role" error={role.error} /> : null}
      {role.isPending ? (
        <div className="flex h-[52px] items-center border-b border-line">
          <Skeleton className="h-5 w-[360px]" />
        </div>
      ) : null}
      {role.data ? (
        <>
          <PageHeader title={role.data.title}>
            <span className="text-[13px] text-muted">
              {role.data.is_mine ? (
                <>
                  Owner <span className="text-cobalt">You</span>
                </>
              ) : (
                `Owner ${role.data.owner_name ?? 'unassigned'}`
              )}
            </span>
            <a
              href={role.data.job_url}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('ghost', 'sm')}
            >
              View posting
              <ExternalIcon className="text-caption" />
            </a>
          </PageHeader>
          <p className="mt-3 text-[13px] text-muted">
            {role.data.team} · {role.data.location}
            {role.data.is_remote ? ' (remote)' : ''} · {titleCase(role.data.seniority)}{' '}
            {titleCase(role.data.job_family)}
          </p>
          {role.data.required_skills.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1" aria-label="Required skills">
              {role.data.required_skills.map((s) => {
                const on = filters.skills.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => dispatch({ type: 'toggle', field: 'skills', value: s })}
                    className={`${chipClass(on)} ${on ? '' : 'hover:bg-paper'}`}
                    title={on ? `Stop filtering by ${s}` : `Only candidates with ${s}`}
                    aria-pressed={on}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {requestItems.length > 0 ? (
        <section
          aria-label="Requests for this role"
          className="mt-4 flex min-h-9 flex-wrap items-center gap-x-5 gap-y-1 rounded-[8px] bg-ice px-3 py-1 text-[13px]"
        >
          <span className="font-semibold text-reach-text">
            Requests <span className="font-medium tnum">{requestItems.length}</span>
          </span>
          <ul className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
            {requestItems.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Link to={`/requests/${r.id}`} className="font-medium text-ink hover:underline">
                  {r.contact.full_name}
                </Link>
                <StatusPill status={r.status} />
              </li>
            ))}
            {requestItems.length > 5 ? (
              <li className="text-muted">+{requestItems.length - 5} more</li>
            ) : null}
          </ul>
          <Link to={`/pipeline?role_id=${id}&scope=all`} className="link ml-auto">
            Open in pipeline
          </Link>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Candidate filters">
        <input
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search by name, company or title"
          aria-label="Search candidates"
          className="field h-8 w-[240px] text-[13px]"
        />
        <MultiSelect
          label="Company"
          options={toOptions(options.data?.companies)}
          selected={filters.companies}
          onChange={(values) => dispatch({ type: 'setList', field: 'companies', values })}
        />
        <MultiSelect
          label="School"
          options={toOptions(options.data?.schools)}
          selected={filters.schools}
          onChange={(values) => dispatch({ type: 'setList', field: 'schools', values })}
        />
        <MultiSelect
          label="Skill"
          options={(options.data?.skills ?? []).map((s) => ({ value: s }))}
          selected={filters.skills}
          onChange={(values) => dispatch({ type: 'setList', field: 'skills', values })}
        />
        <button
          type="button"
          aria-pressed={tier1Only}
          onClick={() => dispatch({ type: 'setTier', tier: tier1Only ? null : 1 })}
          className={filterPillClass(tier1Only)}
        >
          Tier-1 only
        </button>
        {chips.length > 0 ? (
          <>
            <span aria-hidden className="mx-1 h-4 w-px bg-line" />
            {chips.map((c) => (
              <RemovableChip key={c.key} label={c.label} onRemove={() => dispatch(c.remove)} />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[12px]"
              onClick={() => dispatch({ type: 'clear' })}
            >
              Clear all
            </Button>
          </>
        ) : null}
        <p className="ml-auto text-[12px] text-muted tnum" aria-live="polite">
          {page
            ? `${formatCount(page.total)} strong ${page.total === 1 ? 'candidate' : 'candidates'}${
                page.total > page.limit
                  ? ` · ${formatCount(page.offset + 1)}–${formatCount(
                      Math.min(page.offset + page.limit, page.total),
                    )}`
                  : ''
              }`
            : ' '}
          {candidates.isFetching && page ? <span className="ml-2">updating</span> : null}
        </p>
      </div>

      <div className="mt-3">
        {candidates.isPending ? <TableSkeleton rows={10} cols={4} /> : null}
        {candidates.isError ? (
          <ErrorState title="Couldn't load candidates" error={candidates.error} />
        ) : null}
        {page && items.length === 0 ? (
          <EmptyState>
            {nFilters > 0 ? (
              <>
                No candidates match these filters.{' '}
                <button type="button" className="link" onClick={() => dispatch({ type: 'clear' })}>
                  Clear all filters
                </button>
              </>
            ) : (
              'No candidates scored for this role yet. Scores are computed when the network is refreshed.'
            )}
          </EmptyState>
        ) : null}

        {items.length > 0 ? (
          <div className={candidates.isFetching ? 'opacity-80' : ''}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-[36%]">Candidate</th>
                  <th className="w-[22%]">Why</th>
                  <th className="w-[26%]">Warm intro</th>
                  <th className="text-right">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <CandidateRow
                    key={c.contact.id}
                    c={c}
                    selected={c.contact.id === contactId}
                    tier={tierByCompany.get(c.contact.current_company)}
                    onOpen={() => openContact(c.contact.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {page ? (
          <Pagination
            total={page.total}
            limit={page.limit}
            offset={page.offset}
            noun="candidates"
            onPage={(offset) => dispatch({ type: 'setPage', offset })}
          />
        ) : null}
      </div>

      <Drawer open={Boolean(contactId)} onClose={closeContact} title="Candidate">
        {contactId ? (
          <CandidateDrawer
            contactId={contactId}
            roleId={id}
            roleTitle={role.data?.title ?? ''}
            reasons={items.find((c) => c.contact.id === contactId)?.reasons}
            onClose={closeContact}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

function toOptions(list: TieredName[] | undefined) {
  return (list ?? []).map((t) => ({ value: t.name, tier: t.tier }));
}

function CandidateRow({
  c,
  selected,
  tier,
  onOpen,
}: {
  c: CandidateOut;
  selected: boolean;
  tier: number | undefined;
  onOpen: () => void;
}) {
  const top = c.top_connection;
  const why = whyLine(c.reasons);
  return (
    <tr
      tabIndex={0}
      aria-selected={selected}
      className={`is-clickable ${selected ? 'is-selected' : ''}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <td>
        <div className="font-medium leading-5 text-ink">{c.contact.full_name}</div>
        <div className="flex items-center gap-1.5 text-[12px] leading-4 tracking-normal text-muted">
          <span className="truncate">
            {c.contact.current_title} at {c.contact.current_company}
          </span>
          {tier !== undefined ? <TierBadge tier={tier} /> : null}
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">{c.contact.location}</span>
        </div>
      </td>
      <td>
        <div
          className="max-w-[280px] truncate text-[13px] text-carbon"
          title={c.reasons.map((r) => r.label).join('; ')}
        >
          {why || <span className="text-caption">No stored signals</span>}
        </div>
      </td>
      <td>
        {top ? (
          <>
            <div className="text-[13px] leading-5 text-carbon">
              via <span className="font-medium text-ink">{top.employee.full_name}</span>
              {c.connection_count > 1 ? (
                <span className="ml-1.5 text-[12px] text-muted tnum">
                  +{c.connection_count - 1}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-[12px] leading-4 tracking-normal text-muted">
              <StrengthBar value={top.strength} />
              {top.shared_history ? <span className="truncate">{top.shared_history}</span> : null}
            </div>
          </>
        ) : (
          <span className="text-[13px] text-caption">No one at Cognition knows them</span>
        )}
      </td>
      <td className="text-right">
        {c.active_request ? (
          <div className="inline-flex items-center gap-2">
            <StatusPill status={c.active_request.status} />
            <Link
              to={`/requests/${c.active_request.id}`}
              className="link text-[12px]"
              onClick={(e) => e.stopPropagation()}
            >
              for {c.active_request.role_title}
            </Link>
          </div>
        ) : top ? (
          <Button
            variant="primary"
            size="sm"
            title={`Ask ${top.employee.full_name} to vouch for ${firstName(c.contact.full_name)}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            Ask {firstName(top.employee.full_name)}
          </Button>
        ) : (
          <span className="text-[12px] text-caption">No one to ask</span>
        )}
      </td>
    </tr>
  );
}
