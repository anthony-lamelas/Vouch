import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { keys, useAskPreview, useContact, useCreateRequest } from '../api/queries';
import type { ConnectionOut, ContactDetail, Reason, RequestDetail } from '../api/types';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { ErrorState, Skeleton } from '../components/EmptyState';
import { XIcon } from '../components/Icons';
import { SectionTitle } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { StrengthBar } from '../components/StrengthBar';
import { firstName, formatRelative, formatSpan } from '../lib/format';
import { sortEducation, sortExperiences } from '../lib/history';

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
      <div className="flex items-start gap-3 border-b border-line px-5 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          {data ? (
            <>
              <h2 className="text-[18px] font-semibold leading-6 tracking-[-0.01em] text-ink">
                {data.full_name}
              </h2>
              <p className="mt-0.5 text-[13px] text-carbon">{data.headline}</p>
              <p className="mt-0.5 text-[12px] tracking-normal text-muted">
                {data.location}
                <a href={data.linkedin_url} target="_blank" rel="noreferrer" className="link ml-3">
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
          className="-mr-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] text-muted hover:bg-haze hover:text-ink"
        >
          <XIcon />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {contact.isError ? (
          <ErrorState title="Couldn't load this candidate" error={contact.error} />
        ) : null}
        {data ? (
          <>
            {create.isSuccess ? (
              <Sent req={create.data} />
            ) : openRequest ? (
              <Notice>
                Already in the pipeline for{' '}
                <span className="text-ink">{openRequest.role.title}</span> via{' '}
                {openRequest.employee.full_name}.{' '}
                <Link to={`/requests/${openRequest.id}`} className="link">
                  Open the request
                </Link>
              </Notice>
            ) : connections.length === 0 ? (
              <Notice>
                No one at Cognition is connected to {firstName(data.full_name)}, so there is nobody
                to ask.
              </Notice>
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
              <ol className="ml-[3px] space-y-2 border-l border-line pl-3.5 text-[13px]">
                {sortExperiences(data.experiences).map((e, i) => (
                  <li key={i} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-[17.5px] top-[6px] size-[7px] rounded-full ring-2 ring-canvas ${
                        e.end ? 'bg-line' : 'bg-cobalt'
                      }`}
                    />
                    <div className="leading-5 text-ink">
                      <span className="font-medium">{e.title ?? '—'}</span>
                      <span className="text-carbon"> at {e.company ?? '—'}</span>
                    </div>
                    <div className="text-[12px] tracking-normal text-muted tnum">
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
                <ul className="space-y-1 text-[13px]">
                  {sortEducation(data.education).map((ed, i) => (
                    <li key={i}>
                      <div className="text-ink">{ed.school ?? '—'}</div>
                      <div className="text-[12px] tracking-normal text-muted tnum">
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
                    <li key={c.employee.id} className="py-1.5">
                      <ConnectionLine c={c} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <SectionTitle>Past requests</SectionTitle>
              {data.requests.length === 0 ? (
                <p className="text-[13px] text-muted">
                  No one has been asked about this person before.
                </p>
              ) : (
                <ul className="divide-y divide-line text-[13px]">
                  {data.requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                      <div className="min-w-0">
                        <Link to={`/requests/${r.id}`} className="link font-medium">
                          {r.role.title}
                        </Link>
                        <span className="ml-2 text-[12px] tracking-normal text-muted">
                          asked {r.employee.full_name} {formatRelative(r.created_at)}
                        </span>
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

function Notice({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-card bg-paper p-3 text-[13px] text-carbon">{children}</section>
  );
}

function ConnectionLine({
  c,
  withBar = true,
  selected = false,
}: {
  c: ConnectionOut;
  /** The read-only connections list keeps its strength bar; the picker does not. */
  withBar?: boolean;
  selected?: boolean;
}) {
  return (
    <div className="min-w-0 text-[13px]">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate">
          <span className={`font-medium ${selected ? 'text-cobalt' : 'text-ink'}`}>
            {c.employee.full_name}
          </span>
          <span className="text-[12px] tracking-normal text-muted">
            {' '}
            {c.employee.title}
            {c.employee.team ? `, ${c.employee.team}` : ''}
          </span>
        </span>
        {withBar ? <StrengthBar value={c.strength} /> : null}
      </div>
      {c.shared_history ? (
        <div className="text-[12px] tracking-normal text-carbon">{c.shared_history}</div>
      ) : null}
    </div>
  );
}

function WhyList({ reasons }: { reasons: Reason[] | null }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <section>
      <SectionTitle>Why this candidate</SectionTitle>
      <dl className="divide-y divide-line text-[13px]">
        {reasons.map((r, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-4 py-1.5">
            <dt className="font-medium text-ink">{r.label}</dt>
            <dd className="text-muted">{r.detail ?? ''}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Sent({ req }: { req: RequestDetail }) {
  return (
    <section className="rounded-card bg-yes-bg p-3 text-[13px] text-yes-text" aria-live="polite">
      <p className="font-semibold">Sent to {req.employee.full_name}.</p>
      <p className="mt-0.5">
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
  const draft = preview.data?.ask;
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
    <section aria-labelledby="ask-title" className="rounded-card bg-paper p-3.5">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 id="ask-title" className="text-[13px] font-semibold text-ink">
          Ask
        </h2>
        <span className="truncate text-[12px] tracking-normal text-muted">
          for {roleTitle || 'this role'}
        </span>
      </div>

      <div role="radiogroup" aria-label="Who to ask" className="flex flex-col gap-1">
        {connections.map((c, i) => {
          const checked = c.employee.id === employeeId;
          return (
            <button
              key={c.employee.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onPick(c.employee.id)}
              className={`block w-full rounded-[8px] border px-2.5 py-1.5 text-left transition-colors ${
                checked ? 'border-cobalt bg-ice' : 'border-line bg-canvas hover:bg-haze'
              }`}
            >
              <ConnectionLine c={c} withBar={false} selected={checked} />
              {i === 0 && connections.length > 1 ? (
                <span className="text-[12px] tracking-normal text-cobalt">
                  Strongest connection
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 flex items-baseline justify-between text-[12px] tracking-normal">
          <span className="font-medium text-carbon">Message to {chosenFirst}</span>
          <span className="text-muted">Sent as a Slack DM. Edit it before sending.</span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="textarea-field min-h-[140px] w-full text-[13px]"
          maxLength={2000}
          disabled={preview.isPending || create.isPending}
          placeholder={preview.isPending ? 'Drafting a message' : ''}
          aria-busy={preview.isPending}
        />
      </label>
      {preview.isError ? (
        <p role="alert" className="mt-1 text-[12px] text-no-text">
          Couldn't draft the message. Write one, or try another employee.
        </p>
      ) : null}

      <div className="mt-2.5 flex items-center gap-3">
        <Button
          variant="primary"
          disabled={!employeeId || !message.trim() || create.isPending}
          onClick={send}
        >
          {create.isPending ? 'Sending' : 'Send request'}
        </Button>
        {errorText ? (
          <p role="alert" className="text-[12px] text-no-text">
            {errorText}
          </p>
        ) : null}
      </div>
    </section>
  );
}
