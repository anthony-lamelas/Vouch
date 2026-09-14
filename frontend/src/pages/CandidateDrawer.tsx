import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { keys, useAskPreview, useContact, useCreateRequest } from '../api/queries';
import type { ConnectionOut, ContactDetail, Reason, RequestDetail } from '../api/types';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { ErrorState, Skeleton } from '../components/EmptyState';
import { SectionTitle } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { StrengthBar } from '../components/StrengthBar';
import { firstName, formatRelative, formatSpan } from '../lib/format';

export function CandidateDrawer({
  contactId,
  roleId,
  roleTitle,
  reasons,
  onClose,
}: {
  contactId: string;
  roleId: string;
  roleTitle: string;
  /** Match signals from the candidate row, when the drawer was opened from one. */
  reasons?: Reason[];
  onClose: () => void;
}) {
  const contact = useContact(contactId);
  const create = useCreateRequest();
  const data = contact.data;
  const connections = useMemo(() => sortByStrength(data?.connections ?? []), [data?.connections]);
  const openRequest = data?.requests.find((r) => r.status !== 'closed');
  const pickerVisible =
    Boolean(data) && !openRequest && connections.length > 0 && !create.isSuccess;

  // The employee picker and the message preview live here so the preview's reasons can feed
  // "Why this candidate" even when the drawer was deep-linked rather than opened from a row.
  const strongest = connections[0];
  const [pickedId, setPickedId] = useState<string | undefined>();
  const employeeId =
    pickedId && connections.some((c) => c.employee.id === pickedId)
      ? pickedId
      : strongest?.employee.id;
  const preview = useAskPreview(
    pickerVisible && data && employeeId
      ? { contact_id: data.id, role_id: roleId, employee_id: employeeId }
      : null,
  );
  const why = reasons ?? preview.data?.reasons ?? null;

  return (
    <>
      <div className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          {data ? (
            <>
              <h2 className="font-serif text-[24px] font-medium leading-tight tracking-[-0.01em] text-ink">
                {data.full_name}
              </h2>
              <p className="mt-1 text-ink-2">{data.headline}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {data.location}
                <a href={data.linkedin_url} target="_blank" rel="noreferrer" className="link ml-3">
                  LinkedIn
                </a>
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1.5 shrink-0 rounded-control p-1.5 text-muted hover:bg-neutral-soft hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
        {contact.isError ? (
          <ErrorState title="Couldn't load this candidate" error={contact.error} />
        ) : null}
        {data ? (
          <>
            {create.isSuccess ? (
              <Sent req={create.data} />
            ) : openRequest ? (
              <section className="border-l-2 border-line-strong pl-3 text-ink-2">
                Already in the pipeline for{' '}
                <span className="text-ink">{openRequest.role.title}</span> via{' '}
                {openRequest.employee.full_name}.{' '}
                <Link to={`/requests/${openRequest.id}`} className="link">
                  Open the request
                </Link>
              </section>
            ) : connections.length === 0 ? (
              <section className="border-l-2 border-line-strong pl-3 text-ink-2">
                No one at Cognition is connected to {firstName(data.full_name)}, so there is nobody
                to ask.
              </section>
            ) : (
              <Ask
                contact={data}
                connections={connections}
                roleId={roleId}
                roleTitle={roleTitle}
                create={create}
                employeeId={employeeId}
                onPick={setPickedId}
                preview={preview}
              />
            )}

            <WhyList reasons={why} />

            <section>
              <SectionTitle>Experience</SectionTitle>
              <ol className="ml-1 space-y-2.5 border-l border-line-strong pl-4">
                {data.experiences.map((e, i) => (
                  <li key={i} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-[20.5px] top-[7px] size-[7px] rounded-full ${
                        e.end ? 'bg-line-strong' : 'bg-spruce'
                      }`}
                    />
                    <div className="leading-snug text-ink">
                      <span className="font-medium">{e.title ?? '—'}</span>
                      <span className="text-ink-2"> at {e.company ?? '—'}</span>
                    </div>
                    <div className="text-[13px] text-muted tnum">
                      {e.team ? `${e.team}, ` : ''}
                      {formatSpan(e.start, e.end)}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {data.education.length > 0 ? (
              <section>
                <SectionTitle>Education</SectionTitle>
                <ul className="space-y-1.5">
                  {data.education.map((ed, i) => (
                    <li key={i}>
                      <div className="text-ink">{ed.school ?? '—'}</div>
                      <div className="text-[13px] text-muted tnum">
                        {[ed.degree, ed.field].filter(Boolean).join(', ')}
                        {ed.start_year || ed.end_year
                          ? `, ${String(ed.start_year ?? '?')}–${String(ed.end_year ?? '?')}`
                          : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <SectionTitle>Skills</SectionTitle>
              <div className="flex flex-wrap gap-1">
                {data.skills.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            </section>

            {!pickerVisible && connections.length > 0 ? (
              <section>
                <SectionTitle count={connections.length}>Connections at Cognition</SectionTitle>
                <ul className="divide-y divide-line">
                  {connections.map((c) => (
                    <li key={c.employee.id} className="py-2">
                      <ConnectionLine c={c} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <SectionTitle>Past requests</SectionTitle>
              {data.requests.length === 0 ? (
                <p className="text-muted">No one has been asked about this person before.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.requests.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <Link to={`/requests/${r.id}`} className="link">
                          {r.role.title}
                        </Link>
                        <div className="text-[13px] text-muted">
                          asked {r.employee.full_name} {formatRelative(r.created_at)}
                        </div>
                      </div>
                      <StatusPill status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}

function sortByStrength(list: ConnectionOut[]) {
  return [...list].sort((a, b) => b.strength - a.strength);
}

function ConnectionLine({ c }: { c: ConnectionOut }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">
          <span className="font-medium text-ink">{c.employee.full_name}</span>
          <span className="text-[13px] text-muted">
            {' '}
            {c.employee.title}
            {c.employee.team ? `, ${c.employee.team}` : ''}
          </span>
        </span>
        <StrengthBar value={c.strength} />
      </div>
      {c.shared_history ? <div className="text-[13px] text-ink-2">{c.shared_history}</div> : null}
    </div>
  );
}

function WhyList({ reasons }: { reasons: Reason[] | null }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <section>
      <SectionTitle>Why this candidate</SectionTitle>
      <ul className="space-y-1">
        {reasons.map((r, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-ink">{r.label}</span>
            {r.detail ? <span className="text-[13px] text-muted">{r.detail}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Sent({ req }: { req: RequestDetail }) {
  return (
    <section className="border-l-2 border-spruce pl-3" aria-live="polite">
      <p className="font-medium text-ink">Sent to {req.employee.full_name}.</p>
      <p className="mt-0.5 text-[13.5px] text-ink-2">
        {firstName(req.employee.full_name)} has the message and the role details for{' '}
        {req.role.title}.{' '}
        <Link to={`/requests/${req.id}`} className="link">
          Open the request
        </Link>
      </p>
    </section>
  );
}

function Ask({
  contact,
  connections,
  roleId,
  roleTitle,
  create,
  employeeId,
  onPick,
  preview,
}: {
  contact: ContactDetail;
  connections: ConnectionOut[];
  roleId: string;
  roleTitle: string;
  create: ReturnType<typeof useCreateRequest>;
  employeeId: string | undefined;
  onPick: (id: string) => void;
  preview: ReturnType<typeof useAskPreview>;
}) {
  const [message, setMessage] = useState('');
  const qc = useQueryClient();

  // A new draft arrives whenever the employee changes; it replaces whatever was typed because
  // the wording is personal to that employee's history with the candidate.
  const draft = preview.data?.casual;
  useEffect(() => {
    if (draft !== undefined) setMessage(draft);
  }, [draft]);

  const chosen = connections.find((c) => c.employee.id === employeeId) ?? connections[0];
  const chosenFirst = chosen ? firstName(chosen.employee.full_name) : 'employee';

  const error = create.error;
  let errorText: string | null = null;
  if (error instanceof ApiError) {
    errorText =
      error.status === 409
        ? 'Someone already opened a request for this person. Reloading their details.'
        : `${error.detail}. Try again.`;
  } else if (error) {
    errorText = `${error.message}. Try again.`;
  }

  const send = () => {
    if (!employeeId || !message.trim()) return;
    create.mutate(
      { contact_id: contact.id, role_id: roleId, employee_id: employeeId, message: message.trim() },
      {
        onError: (err) => {
          // A 409 means someone already opened a request; refetch so the drawer switches to
          // "Already in the pipeline" with a link to it.
          if (err instanceof ApiError && err.status === 409) {
            void qc.invalidateQueries({ queryKey: keys.contact(contact.id) });
            void qc.invalidateQueries({ queryKey: ['roles'] });
          }
        },
      },
    );
  };

  return (
    <section aria-labelledby="ask-title">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 id="ask-title" className="text-[14px] font-semibold text-ink">
          Ask
        </h2>
        <span className="truncate text-[13px] text-muted">for {roleTitle || 'this role'}</span>
      </div>

      <fieldset className="-mx-2">
        <legend className="sr-only">Who to ask</legend>
        {connections.map((c, i) => {
          const checked = c.employee.id === employeeId;
          return (
            <label
              key={c.employee.id}
              className={`flex cursor-pointer items-start gap-3 rounded-control px-2 py-2 ${
                checked ? 'bg-spruce-soft' : 'hover:bg-canvas'
              }`}
            >
              <input
                type="radio"
                name="employee"
                value={c.employee.id}
                checked={checked}
                onChange={() => onPick(c.employee.id)}
                className="mt-[3px] accent-spruce"
              />
              <div className="min-w-0 flex-1">
                <ConnectionLine c={c} />
                {i === 0 && connections.length > 1 ? (
                  <span className="text-[12.5px] text-spruce-ink">Strongest connection</span>
                ) : null}
              </div>
            </label>
          );
        })}
      </fieldset>

      <label className="mt-4 block">
        <span className="mb-1 flex items-baseline justify-between text-[13.5px]">
          <span className="font-medium text-ink-2">Message to {chosenFirst}</span>
          <span className="text-muted">Sent as a Slack DM. Edit it before sending.</span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="textarea-field min-h-[150px] w-full text-[14px]"
          maxLength={2000}
          disabled={preview.isPending || create.isPending}
          placeholder={preview.isPending ? 'Drafting a message' : ''}
          aria-busy={preview.isPending}
        />
      </label>
      {preview.isError ? (
        <p role="alert" className="mt-1 text-[13.5px] text-neg">
          Couldn't draft the message. Write one, or try another employee.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="primary"
          disabled={!employeeId || !message.trim() || create.isPending}
          onClick={send}
        >
          {create.isPending ? 'Sending' : `Send to ${chosenFirst}`}
        </Button>
        {errorText ? (
          <p role="alert" className="text-[13.5px] text-neg">
            {errorText}
          </p>
        ) : null}
      </div>
    </section>
  );
}
