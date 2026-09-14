import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCandidates, useFilterOptions, useRequests, useRole } from '../api/queries';
import type { CandidateOut, TieredName } from '../api/types';
import { Button } from '../components/Button';
import { RemovableChip } from '../components/Chip';
import { Drawer } from '../components/Drawer';
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from '../components/EmptyState';
import { ExternalIcon } from '../components/Icons';
import { MultiSelect, type Option } from '../components/MultiSelect';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { StatusPill } from '../components/StatusPill';
import {
  TIERS,
  activeFilterCount,
  appliedFilterChips,
  filtersReducer,
  parseFilters,
  serializeFilters,
  type FilterAction,
  type TierField,
} from '../lib/candidateFilters';
import { buttonClass } from '../lib/classes';
import { firstName, formatCount } from '../lib/format';
import { whyLine } from '../lib/reasons';
import { familyLabel, seniorityLabel } from '../lib/labels';
import { CandidateDrawer } from './CandidateDrawer';

/** "Tier 1 / 2 / 3" rows pinned above the company and school lists. */
const TIER_OPTIONS: Option[] = TIERS.map((t) => ({
  value: String(t),
  label: `Tier ${t}`,
  tier: t,
}));

/** Schools pinned to the very top of their list regardless of tier. */
const PINNED_SCHOOLS = ['NYU'];

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
  const requestItems = roleRequests.data?.items ?? [];
  const companyOptions = useMemo(() => toOptions(options.data?.companies), [options.data]);
  const schoolOptions = useMemo(
    () => toOptions(options.data?.schools, PINNED_SCHOOLS),
    [options.data],
  );
  const tierGroup = (field: TierField) => ({
    options: TIER_OPTIONS,
    selected: filters[field].map(String),
    onChange: (values: string[]) =>
      dispatch({ type: 'setTiers', field, tiers: values.map(Number) }),
  });

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
            {role.data.is_remote ? ' (remote)' : ''} · {seniorityLabel(role.data.seniority)} ·{' '}
            {familyLabel(role.data.job_family)}
          </p>
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
          options={companyOptions}
          selected={filters.companies}
          onChange={(values) => dispatch({ type: 'setList', field: 'companies', values })}
          pinned={tierGroup('companyTiers')}
        />
        <MultiSelect
          label="School"
          options={schoolOptions}
          selected={filters.schools}
          onChange={(values) => dispatch({ type: 'setList', field: 'schools', values })}
          pinned={tierGroup('schoolTiers')}
        />
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
            reasons={items.find((c) => c.contact.id === contactId)?.reasons}
            onClose={closeContact}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

/** Tier 1 first, then by name; anything in `pinnedFirst` jumps to the very top. */
function toOptions(list: TieredName[] | undefined, pinnedFirst: string[] = []): Option[] {
  const rank = (t: TieredName) => {
    const i = pinnedFirst.indexOf(t.name);
    return i === -1 ? pinnedFirst.length : i;
  };
  return [...(list ?? [])]
    .sort((a, b) => rank(a) - rank(b) || a.tier - b.tier || a.name.localeCompare(b.name))
    .map((t) => ({ value: t.name, tier: t.tier }));
}

function CandidateRow({
  c,
  selected,
  onOpen,
}: {
  c: CandidateOut;
  selected: boolean;
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
            {top.shared_history ? (
              <div className="truncate text-[12px] leading-4 tracking-normal text-muted">
                {top.shared_history}
              </div>
            ) : null}
          </>
        ) : (
          <span className="text-[13px] text-caption">No one at Cognition knows them</span>
        )}
      </td>
      <td className="text-right">
        {top ? (
          <Button
            variant="primary"
            size="sm"
            title={`Request an intro to ${firstName(c.contact.full_name)} via ${top.employee.full_name}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            Request
          </Button>
        ) : (
          <span className="text-[12px] text-caption">No one to ask</span>
        )}
      </td>
    </tr>
  );
}
