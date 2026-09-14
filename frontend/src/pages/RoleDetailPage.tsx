import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCandidates, useFilterOptions, useRequests, useRole } from '../api/queries';
import type { CandidateOut, TieredName } from '../api/types';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Drawer } from '../components/Drawer';
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from '../components/EmptyState';
import { MultiSelect } from '../components/MultiSelect';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { ScoreBar } from '../components/ScoreBar';
import { StatusPill } from '../components/StatusPill';
import { TierBadge } from '../components/TierBadge';
import {
  activeFilterCount,
  filtersReducer,
  parseFilters,
  serializeFilters,
  type FilterAction,
} from '../lib/candidateFilters';
import { formatCount, formatPercent, plural, titleCase } from '../lib/format';
import { CandidateDrawer } from './CandidateDrawer';

const MIN_SCORE_OPTIONS = [
  { value: 0, label: 'Any score' },
  { value: 0.3, label: '30%+' },
  { value: 0.5, label: '50%+' },
  { value: 0.7, label: '70%+' },
];

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
  const ask = searchParams.get('ask') === '1';

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
    (next: ReturnType<typeof parseFilters>, extra?: { contact?: string | null; ask?: boolean }) => {
      const keepContact = extra && 'contact' in extra ? extra.contact : contactId;
      const keepAsk = extra && 'ask' in extra ? extra.ask : ask;
      setSearchParams(
        serializeFilters(next, { contact: keepContact ?? null, ask: keepAsk ? '1' : null }),
        { replace: true },
      );
    },
    [ask, contactId, setSearchParams],
  );

  const dispatch = useCallback(
    (action: FilterAction) => write(filtersReducer(filters, action)),
    [filters, write],
  );

  const openContact = (cid: string, withAsk = false) =>
    write(filters, { contact: cid, ask: withAsk });
  const closeContact = useCallback(
    () => write(filters, { contact: null, ask: false }),
    [filters, write],
  );

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
  const tier1Only = filters.companyTier === 1;

  return (
    <div>
      {role.isError ? <ErrorState title="Couldn't load this role" error={role.error} /> : null}
      {role.isPending ? (
        <div className="mb-6 space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-[420px]" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
      ) : null}
      {role.data ? (
        <PageHeader
          crumbs={
            <>
              <Link to="/roles" className="hover:text-ink">
                Roles
              </Link>
              <span className="mx-1.5 text-line-2">/</span>
              <span>{role.data.department}</span>
            </>
          }
          title={role.data.title}
          subtitle={
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
                <span>{role.data.team}</span>
                <span className="text-line-2">|</span>
                <span>
                  {role.data.location}
                  {role.data.is_remote ? ' (remote)' : ''}
                </span>
                <span className="text-line-2">|</span>
                <span>
                  {titleCase(role.data.seniority)} {titleCase(role.data.job_family)}
                </span>
                <span className="text-line-2">|</span>
                <span className="tnum">
                  {plural(role.data.strong_match_count, 'strong match', 'strong matches')}
                </span>
                {role.data.active_request_count > 0 ? (
                  <>
                    <span className="text-line-2">|</span>
                    <Link to={`/pipeline?role_id=${role.data.id}`} className="link tnum">
                      {plural(role.data.active_request_count, 'active request')}
                    </Link>
                  </>
                ) : null}
              </div>
              {role.data.required_skills.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {role.data.required_skills.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => dispatch({ type: 'toggle', field: 'skills', value: s })}
                      className="rounded-[3px]"
                      title={
                        filters.skills.includes(s)
                          ? `Stop filtering by ${s}`
                          : `Filter candidates with ${s}`
                      }
                      aria-pressed={filters.skills.includes(s)}
                    >
                      <Chip tone={filters.skills.includes(s) ? 'accent' : 'default'}>{s}</Chip>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          }
        >
          <a
            href={role.data.job_url}
            target="_blank"
            rel="noreferrer"
            className="link text-[12.5px]"
          >
            View posting on Ashby
          </a>
        </PageHeader>
      ) : null}

      {roleRequests.data && roleRequests.data.items.length > 0 ? (
        <section
          aria-label="Requests for this role"
          className="mb-3 rounded-md border border-line bg-surface px-4 py-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">
              Requests for this role
              <span className="ml-2 font-normal normal-case tracking-normal text-muted tnum">
                {roleRequests.data.total}
              </span>
            </h2>
            <Link to={`/pipeline?role_id=${id}&scope=all`} className="link text-[12.5px]">
              Open in pipeline
            </Link>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            {roleRequests.data.items.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[13px]">
                <Link to={`/requests/${r.id}`} className="font-medium text-ink hover:underline">
                  {r.contact.full_name}
                </Link>
                <span className="text-muted">via {r.employee.full_name.split(' ')[0]}</span>
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Filter bar */}
      <div className="sticky top-12 z-20 -mx-6 px-6 py-2.5 bg-ground/95 backdrop-blur border-b border-line mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Name, company or title"
            aria-label="Search candidates"
            className="field w-[240px]"
          />
          <button
            type="button"
            aria-pressed={tier1Only}
            onClick={() => dispatch({ type: 'setTier', tier: tier1Only ? null : 1 })}
            className={`field inline-flex items-center gap-1.5 text-[13px] ${
              tier1Only ? 'border-accent bg-accent-soft/60 text-accent-ink' : 'text-ink-2'
            }`}
          >
            <TierBadge tier={1} />
            Tier-1 companies only
          </button>
          <MultiSelect
            label="Companies"
            options={toOptions(options.data?.companies)}
            selected={filters.companies}
            onChange={(values) => dispatch({ type: 'setList', field: 'companies', values })}
          />
          <MultiSelect
            label="Schools"
            options={toOptions(options.data?.schools)}
            selected={filters.schools}
            onChange={(values) => dispatch({ type: 'setList', field: 'schools', values })}
          />
          <MultiSelect
            label="Skills"
            options={(options.data?.skills ?? []).map((s) => ({ value: s }))}
            selected={filters.skills}
            onChange={(values) => dispatch({ type: 'setList', field: 'skills', values })}
          />
          <select
            aria-label="Minimum score"
            value={String(filters.minScore)}
            onChange={(e) => dispatch({ type: 'setMinScore', minScore: Number(e.target.value) })}
            className="field text-[13px] pr-7"
          >
            {MIN_SCORE_OPTIONS.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
          {nFilters > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'clear' })}>
              Clear {nFilters === 1 ? 'filter' : `${nFilters} filters`}
            </Button>
          ) : null}
          <span className="ml-auto text-[12.5px] text-muted tnum">
            {page
              ? `${formatCount(page.total)} ${page.total === 1 ? 'candidate' : 'candidates'}`
              : ''}
            {candidates.isFetching && page ? (
              <span className="ml-2 text-faint">updating…</span>
            ) : null}
          </span>
        </div>
      </div>

      {candidates.isPending ? <TableSkeleton rows={10} cols={6} /> : null}
      {candidates.isError ? (
        <ErrorState title="Couldn't load candidates" error={candidates.error} />
      ) : null}
      {page && items.length === 0 ? (
        <EmptyState
          title={
            nFilters > 0
              ? 'No candidates match these filters'
              : 'No candidates scored for this role yet'
          }
          action={
            nFilters > 0 ? (
              <Button onClick={() => dispatch({ type: 'clear' })}>Clear filters</Button>
            ) : undefined
          }
        >
          {nFilters > 0
            ? 'Loosen a filter or lower the minimum score.'
            : 'Scores are computed when the network is refreshed.'}
        </EmptyState>
      ) : null}

      {items.length > 0 ? (
        <div
          className={`rounded-md border border-line bg-surface overflow-hidden ${candidates.isFetching ? 'opacity-90' : ''}`}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[24%]">Candidate</th>
                <th>Company</th>
                <th>Score</th>
                <th className="w-[22%]">Why</th>
                <th className="w-[20%]">Best connection</th>
                <th className="text-right">Referral</th>
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
                  onAsk={() => openContact(c.contact.id, true)}
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

      <Drawer open={Boolean(contactId)} onClose={closeContact} title="Candidate">
        {contactId ? (
          <CandidateDrawer
            contactId={contactId}
            roleId={id}
            roleTitle={role.data?.title ?? ''}
            askByDefault={ask}
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
  onAsk,
}: {
  c: CandidateOut;
  selected: boolean;
  tier: number | undefined;
  onOpen: () => void;
  onAsk: () => void;
}) {
  const top = c.top_connection;
  const reasons = c.reasons.slice(0, 3);
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
        <div className="font-medium text-ink">{c.contact.full_name}</div>
        <div className="text-[12px] text-muted leading-snug">{c.contact.headline}</div>
        <div className="text-[12px] text-faint">{c.contact.location}</div>
      </td>
      <td>
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          {c.contact.current_company}
          {tier !== undefined ? <TierBadge tier={tier} /> : null}
        </span>
      </td>
      <td>
        <ScoreBar value={c.score} />
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {reasons.map((r, i) => (
            <Chip key={`${r.label}-${i}`} title={r.detail ?? undefined}>
              {r.label}
            </Chip>
          ))}
        </div>
      </td>
      <td className="text-[12.5px]">
        {top ? (
          <>
            <div className="text-ink">
              via <span className="font-medium">{top.employee.full_name}</span>
              <span className="ml-1.5 text-muted tnum">{formatPercent(top.strength)}</span>
            </div>
            {top.shared_history ? (
              <div className="text-muted leading-snug">{top.shared_history}</div>
            ) : null}
            {c.connection_count > 1 ? (
              <div className="text-faint tnum">+{c.connection_count - 1} more</div>
            ) : null}
          </>
        ) : (
          <span className="text-faint">No employee connection</span>
        )}
      </td>
      <td className="text-right">
        {c.active_request ? (
          <div className="inline-flex flex-col items-end gap-0.5">
            <StatusPill status={c.active_request.status} size="sm" />
            <span className="text-[11.5px] text-muted">for {c.active_request.role_title}</span>
            <Link
              to={`/requests/${c.active_request.id}`}
              className="link text-[11.5px]"
              onClick={(e) => e.stopPropagation()}
            >
              Open request
            </Link>
          </div>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={!top}
            title={top ? `Ask ${top.employee.full_name}` : 'No employee knows this person'}
            onClick={(e) => {
              e.stopPropagation();
              onAsk();
            }}
          >
            Request referral
          </Button>
        )}
      </td>
    </tr>
  );
}
