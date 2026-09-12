import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { keys, useContact, useCreateRequest } from '../api/queries';
import type { ConnectionOut, ContactDetail } from '../api/types';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { ErrorState, Skeleton } from '../components/EmptyState';
import { SectionTitle } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { formatDate, formatPercent, formatRelative, formatSpan, titleCase } from '../lib/format';

export function CandidateDrawer({
  contactId,
  roleId,
  roleTitle,
  askByDefault,
  onClose,
}: {
  contactId: string;
  roleId: string;
  roleTitle: string;
  askByDefault: boolean;
  onClose: () => void;
}) {
  const contact = useContact(contactId);
  return (
    <>
      <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-line">
        <div className="min-w-0 flex-1">
          {contact.data ? (
            <>
              <h2 className="text-[19px] font-semibold leading-tight text-ink">
                {contact.data.full_name}
              </h2>
              <p className="mt-0.5 text-ink-2">{contact.data.headline}</p>
              <p className="text-[12.5px] text-muted">
                {contact.data.location} · {titleCase(contact.data.seniority)}{' '}
                {titleCase(contact.data.job_family)} ·{' '}
                <a
                  href={contact.data.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  LinkedIn
                </a>
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 -mr-1 rounded p-1 text-muted hover:text-ink hover:bg-raised"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {contact.isError ? (
          <ErrorState title="Couldn't load this candidate" error={contact.error} />
        ) : null}
        {contact.data ? (
          <>
            <RequestReferral
              contact={contact.data}
              roleId={roleId}
              roleTitle={roleTitle}
              expandedByDefault={askByDefault}
            />

            <section>
              <SectionTitle>Skills</SectionTitle>
              <div className="flex flex-wrap gap-1">
                {contact.data.skills.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle>Experience</SectionTitle>
              <ol className="relative border-l border-line-2 ml-1.5 pl-4 space-y-3">
                {contact.data.experiences.map((e, i) => (
                  <li key={i} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-[21.5px] top-1.5 size-2 rounded-full border-2 border-surface ${
                        e.end ? 'bg-line-2' : 'bg-accent'
                      }`}
                    />
                    <div className="text-ink font-medium leading-snug">
                      {e.title ?? '—'}
                      <span className="font-normal text-ink-2"> at {e.company ?? '—'}</span>
                    </div>
                    <div className="text-[12.5px] text-muted tnum">
                      {e.team ? `${e.team} · ` : ''}
                      {formatSpan(e.start, e.end)}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {contact.data.education.length > 0 ? (
              <section>
                <SectionTitle>Education</SectionTitle>
                <ul className="space-y-1.5">
                  {contact.data.education.map((ed, i) => (
                    <li key={i}>
                      <div className="text-ink">{ed.school ?? '—'}</div>
                      <div className="text-[12.5px] text-muted tnum">
                        {[ed.degree, ed.field].filter(Boolean).join(', ')}
                        {ed.start_year || ed.end_year
                          ? ` · ${ed.start_year ?? '?'}–${ed.end_year ?? '?'}`
                          : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <SectionTitle aside={`${contact.data.connections.length} at Cognition`}>
                Who knows them
              </SectionTitle>
              {contact.data.connections.length === 0 ? (
                <p className="text-muted">No employee is connected to this person.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {sortByStrength(contact.data.connections).map((c) => (
                    <li key={c.employee.id} className="py-2.5">
                      <ConnectionRow c={c} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {contact.data.top_roles.length > 0 ? (
              <section>
                <SectionTitle>Best-fit roles</SectionTitle>
                <ul className="space-y-1">
                  {contact.data.top_roles.map((r) => (
                    <li key={r.role_id} className="flex items-baseline justify-between gap-3">
                      <Link
                        to={`/roles/${r.role_id}?contact=${contactId}`}
                        className={`link truncate ${r.role_id === roleId ? 'font-medium' : ''}`}
                      >
                        {r.title}
                        <span className="text-muted no-underline"> · {r.team}</span>
                      </Link>
                      <span className="tnum text-ink-2 shrink-0">{formatPercent(r.score)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <SectionTitle>Referral history</SectionTitle>
              {contact.data.requests.length === 0 ? (
                <p className="text-muted">No referral has been requested for this person.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {contact.data.requests.map((r) => (
                    <li key={r.id} className="py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/requests/${r.id}`} className="link">
                          {r.role.title}
                        </Link>
                        <div className="text-[12.5px] text-muted">
                          asked {r.employee.full_name} · {formatRelative(r.created_at)}
                        </div>
                      </div>
                      <StatusPill status={r.status} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <p className="text-[11.5px] text-faint">
              Profile source: {contact.data.enrichment_source}
            </p>
          </>
        ) : null}
      </div>
    </>
  );
}

function sortByStrength(list: ConnectionOut[]) {
  return [...list].sort((a, b) => b.strength - a.strength);
}

function ConnectionRow({ c, compact = false }: { c: ConnectionOut; compact?: boolean }) {
  const b = c.breakdown;
  const parts: { label: string; value: number | undefined; detail: string | null | undefined }[] = [
    { label: 'Worked together', value: b.overlap, detail: b.overlap_detail },
    { label: 'School', value: b.school, detail: b.school_detail },
    {
      label: 'Recency',
      value: b.recency,
      detail: b.connected_on ? `Connected ${formatDate(b.connected_on)}` : null,
    },
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="font-medium text-ink">{c.employee.full_name}</span>
          <span className="text-muted text-[12.5px]">
            {' '}
            · {c.employee.title}
            {c.employee.team ? `, ${c.employee.team}` : ''}
          </span>
        </div>
        <span className="tnum text-ink font-medium shrink-0">{formatPercent(c.strength)}</span>
      </div>
      {c.shared_history ? <div className="text-[12.5px] text-ink-2">{c.shared_history}</div> : null}
      {!compact ? (
        <dl className="mt-1.5 grid grid-cols-3 gap-2 text-[11.5px]">
          {parts.map((p) => (
            <div key={p.label} className="rounded bg-ground px-2 py-1">
              <dt className="text-muted flex justify-between">
                <span>{p.label}</span>
                <span className="tnum text-ink-2">
                  {p.value === undefined ? '—' : formatPercent(p.value)}
                </span>
              </dt>
              <dd className="m-0 text-ink-2 truncate" title={p.detail ?? undefined}>
                {p.detail ?? '—'}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function RequestReferral({
  contact,
  roleId,
  roleTitle,
  expandedByDefault,
}: {
  contact: ContactDetail;
  roleId: string;
  roleTitle: string;
  expandedByDefault: boolean;
}) {
  const connections = useMemo(() => sortByStrength(contact.connections), [contact.connections]);
  const strongest = connections[0];
  const [employeeId, setEmployeeId] = useState<string | undefined>(strongest?.employee.id);
  const [expanded, setExpanded] = useState(expandedByDefault);
  const create = useCreateRequest();
  const qc = useQueryClient();

  useEffect(() => {
    setEmployeeId(strongest?.employee.id);
  }, [strongest?.employee.id]);

  const openRequest = contact.requests.find((r) => r.status !== 'closed');
  const chosen = connections.find((c) => c.employee.id === employeeId);

  if (create.isSuccess) {
    const req = create.data;
    return (
      <section className="rounded-md border border-pos/30 bg-pos-soft px-4 py-3">
        <p className="font-medium text-pos">Referral requested</p>
        <p className="text-[12.5px] text-ink-2 mt-0.5">
          {req.employee.full_name} has been asked about {req.contact.full_name} for {req.role.title}
          .
        </p>
        <Link to={`/requests/${req.id}`} className="link text-[12.5px] mt-1 inline-block">
          Open the request
        </Link>
      </section>
    );
  }

  if (openRequest) {
    return (
      <section className="rounded-md border border-line bg-ground px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-ink">Already in the pipeline</p>
          <StatusPill status={openRequest.status} size="sm" />
        </div>
        <p className="text-[12.5px] text-ink-2 mt-0.5">
          {openRequest.employee.full_name} was asked about them for {openRequest.role.title}. One
          open request per person at a time.
        </p>
        <Link to={`/requests/${openRequest.id}`} className="link text-[12.5px] mt-1 inline-block">
          Open the request
        </Link>
      </section>
    );
  }

  if (connections.length === 0) {
    return (
      <section className="rounded-md border border-line bg-ground px-4 py-3 text-ink-2">
        No one at Cognition is connected to this person, so there is nobody to ask.
      </section>
    );
  }

  const error = create.error;
  let errorText: string | null = null;
  if (error instanceof ApiError) {
    if (error.status === 409) errorText = 'This person already has an open request.';
    else errorText = error.detail;
  } else if (error) {
    errorText = error.message;
  }

  if (!expanded) {
    return (
      <section className="rounded-md border border-accent/30 bg-accent-soft/40 px-4 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0 text-[12.5px] text-ink-2">
          Strongest connection is{' '}
          <span className="font-medium text-ink">{strongest?.employee.full_name}</span>
          {strongest?.shared_history
            ? ` (${strongest.shared_history.charAt(0).toLowerCase() + strongest.shared_history.slice(1)})`
            : ''}
          .
        </div>
        <Button variant="primary" size="sm" onClick={() => setExpanded(true)}>
          Request referral
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-accent/40 bg-surface">
      <div className="px-4 pt-3 pb-2 border-b border-line">
        <p className="font-medium text-ink">Request a referral</p>
        <p className="text-[12.5px] text-muted">
          For <span className="text-ink-2">{roleTitle || 'this role'}</span>. Choose who to ask; the
          strongest connection is selected.
        </p>
      </div>
      <fieldset className="px-2 py-1.5">
        <legend className="sr-only">Employee to ask</legend>
        {connections.map((c, i) => {
          const checked = c.employee.id === employeeId;
          return (
            <label
              key={c.employee.id}
              className={`flex gap-3 items-start rounded px-2 py-2 cursor-pointer ${
                checked ? 'bg-accent-soft/60' : 'hover:bg-ground'
              }`}
            >
              <input
                type="radio"
                name="employee"
                value={c.employee.id}
                checked={checked}
                onChange={() => setEmployeeId(c.employee.id)}
                className="mt-1 accent-accent"
              />
              <div className="min-w-0 flex-1">
                <ConnectionRow c={c} compact />
                {i === 0 ? (
                  <span className="text-[11.5px] text-accent-ink">Strongest connection</span>
                ) : null}
              </div>
            </label>
          );
        })}
      </fieldset>
      <div className="px-4 py-3 border-t border-line flex items-center gap-3">
        <Button
          variant="primary"
          disabled={!employeeId || create.isPending}
          onClick={() =>
            create.mutate(
              { contact_id: contact.id, role_id: roleId, employee_id: employeeId },
              {
                onError: (err) => {
                  // A 409 means someone already opened a request; refetch so the panel
                  // switches to "Already in the pipeline" with a link to it.
                  if (err instanceof ApiError && err.status === 409) {
                    void qc.invalidateQueries({ queryKey: keys.contact(contact.id) });
                    void qc.invalidateQueries({ queryKey: ['roles'] });
                  }
                },
              },
            )
          }
        >
          {create.isPending ? 'Sending…' : `Ask ${chosen?.employee.full_name ?? ''}`.trim()}
        </Button>
        <Button variant="ghost" onClick={() => setExpanded(false)} disabled={create.isPending}>
          Cancel
        </Button>
        {errorText ? (
          <p role="alert" className="text-[12.5px] text-neg ml-auto">
            {errorText}
          </p>
        ) : null}
      </div>
    </section>
  );
}
