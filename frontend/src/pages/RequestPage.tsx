import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useRequest, useTransitionRequest } from '../api/queries';
import type { DeclineReason, RequestDetail, Status } from '../api/types';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { CopyButton } from '../components/CopyButton';
import { KV } from '../components/DefinitionList';
import { DeliveryMark } from '../components/DeliveryMark';
import { Disclosure } from '../components/Disclosure';
import { ErrorState, Skeleton } from '../components/EmptyState';
import { PageHeader, SectionTitle } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { formatDate, formatDateTime, formatPercent, formatRelative } from '../lib/format';
import { DECLINE_REASON_LABELS, STATUS_LABELS } from '../lib/status';

export function RequestPage() {
  const { id = '' } = useParams();
  const request = useRequest(id);

  if (request.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-[460px]" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (request.isError) {
    return <ErrorState title="Couldn't load this request" error={request.error} />;
  }
  const r = request.data;
  return <RequestView r={r} />;
}

function RequestView({ r }: { r: RequestDetail }) {
  const events = useMemo(
    () =>
      [...r.events].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [r.events],
  );
  const canClose = r.allowed_transitions.includes('closed');
  const manual = r.allowed_transitions.filter((s) => s !== 'closed');

  return (
    <div>
      <PageHeader
        crumbs={
          <>
            <Link to="/pipeline" className="hover:text-ink">
              Pipeline
            </Link>
            <span className="mx-1.5 text-line-2">/</span>
            <span>Request</span>
          </>
        }
        title={
          <span>
            {r.contact.full_name}
            <span className="text-muted font-medium"> for </span>
            {r.role.title}
          </span>
        }
        subtitle={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusPill status={r.status} />
            <span className="text-[12.5px]">
              Requested by {r.requested_by} · {formatDate(r.created_at)} · last activity{' '}
              {formatRelative(r.last_event_at ?? r.updated_at)}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <Panel title="Candidate">
              <dl>
                <KV label="Name">
                  <Link to={`/roles/${r.role.id}?contact=${r.contact.id}`} className="link">
                    {r.contact.full_name}
                  </Link>
                </KV>
                <KV label="Now">{r.contact.headline}</KV>
                <KV label="Location">{r.contact.location}</KV>
                <KV label="Skills">
                  <div className="flex flex-wrap gap-1">
                    {r.contact.skills.map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </div>
                </KV>
              </dl>
            </Panel>
            <Panel title="Role">
              <dl>
                <KV label="Title">
                  <Link to={`/roles/${r.role.id}`} className="link">
                    {r.role.title}
                  </Link>
                </KV>
                <KV label="Team">{r.role.team}</KV>
                <KV label="Department">{r.role.department}</KV>
                <KV label="Location">{r.role.location}</KV>
              </dl>
            </Panel>
            <Panel title="Employee asked">
              <dl>
                <KV label="Name">{r.employee.full_name}</KV>
                <KV label="Title">{r.employee.title}</KV>
                <KV label="Team">{r.employee.team ?? '—'}</KV>
                {r.connection ? (
                  <KV label="Strength">
                    <span className="tnum">{formatPercent(r.connection.strength)}</span>
                    {r.connection.shared_history ? (
                      <span className="block text-[12.5px] text-muted">
                        {r.connection.shared_history}
                      </span>
                    ) : null}
                  </KV>
                ) : null}
              </dl>
            </Panel>
          </div>

          <Panel title="Why this candidate">
            {r.reasons.length === 0 ? (
              <p className="text-muted">No stored match signals for this pair.</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                {r.reasons.map((reason, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-[13px]">
                    <span className="font-medium text-ink whitespace-nowrap">{reason.label}</span>
                    {reason.detail ? (
                      <span className="text-muted truncate" title={reason.detail}>
                        {reason.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {r.connection ? (
              <div className="mt-3 pt-3 border-t border-line">
                <p className="text-[12.5px] text-muted mb-1">Why {r.employee.full_name}</p>
                <Breakdown connection={r.connection} />
              </div>
            ) : null}
          </Panel>

          <Panel title="Drafts sent to the employee">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Draft label="Casual DM" text={r.outreach_casual} />
              <Draft label="Email" text={r.outreach_formal} />
            </div>
          </Panel>

          <Panel title="Messages">
            {r.messages.length === 0 ? (
              <p className="text-muted">No message has been sent for this request.</p>
            ) : (
              <ul className="divide-y divide-line">
                {r.messages.map((m) => (
                  <li key={m.id} className="py-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="text-ink">
                      {m.channel === 'slack' ? 'Slack DM' : m.channel} to{' '}
                      <span className="font-medium">{m.employee.full_name}</span>
                      <span className="text-muted text-[12px]"> ({m.recipient})</span>
                    </span>
                    <DeliveryMark delivered={m.delivered} error={m.error} channel={m.channel} />
                    <span className="ml-auto text-[12.5px] text-muted tnum">
                      {formatDateTime(m.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Actions">
            <Actions r={r} canClose={canClose} manual={manual} />
          </Panel>
          <Panel title="Timeline">
            <ol className="relative border-l border-line-2 ml-1.5 pl-4 space-y-3">
              {events.map((e, i) => (
                <li key={e.id} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[21.5px] top-1.5 size-2 rounded-full border-2 border-surface ${
                      i === events.length - 1 ? 'bg-accent' : 'bg-line-2'
                    }`}
                  />
                  <div className="text-[13px] text-ink">
                    <span className="font-medium">{e.actor_label}</span>{' '}
                    {e.from_status ? (
                      <span className="text-muted">
                        moved it from {STATUS_LABELS[e.from_status]} to{' '}
                      </span>
                    ) : (
                      <span className="text-muted">opened it as </span>
                    )}
                    <span className="font-medium">{STATUS_LABELS[e.to_status]}</span>
                  </div>
                  {e.note ? (
                    <div className="text-[12.5px] text-ink-2 mt-0.5">“{e.note}”</div>
                  ) : null}
                  <div className="text-[11.5px] text-faint tnum" title={e.created_at}>
                    {formatDateTime(e.created_at)} · {formatRelative(e.created_at)}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-surface px-4 py-3">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

function Draft({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
        <CopyButton text={text} />
      </div>
      <pre className="m-0 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink-2 rounded bg-ground border border-line px-3 py-2 max-h-[260px] overflow-auto">
        {text}
      </pre>
    </div>
  );
}

function Breakdown({ connection }: { connection: NonNullable<RequestDetail['connection']> }) {
  const b = connection.breakdown;
  const rows: [string, number | undefined, string | null | undefined][] = [
    ['Worked together', b.overlap, b.overlap_detail],
    ['School', b.school, b.school_detail],
    ['Recency', b.recency, b.connected_on ? `Connected ${formatDate(b.connected_on)}` : null],
  ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px]">
      {rows.map(([label, value, detail]) => (
        <div key={label} className="rounded bg-ground px-2.5 py-1.5">
          <dt className="flex justify-between text-muted">
            <span>{label}</span>
            <span className="tnum text-ink-2">
              {value === undefined ? '—' : formatPercent(value)}
            </span>
          </dt>
          <dd className="m-0 text-ink-2 truncate" title={detail ?? undefined}>
            {detail ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Actions({
  r,
  canClose,
  manual,
}: {
  r: RequestDetail;
  canClose: boolean;
  manual: Status[];
}) {
  const transition = useTransitionRequest(r.id);
  const [outcome, setOutcome] = useState('');
  const [manualStatus, setManualStatus] = useState<Status | ''>(manual[0] ?? '');
  const [manualNote, setManualNote] = useState('');
  const [reason, setReason] = useState<DeclineReason>('dont_know_well');
  const [attemptedClose, setAttemptedClose] = useState(false);

  const err = transition.error;
  const errorText = err instanceof ApiError ? err.detail : err ? err.message : null;

  if (r.status === 'closed') {
    return (
      <div>
        <p className="text-ink-2">This request is closed.</p>
        {r.closed_outcome ? (
          <p className="mt-1 text-[12.5px] text-muted">Outcome: “{r.closed_outcome}”</p>
        ) : null}
      </div>
    );
  }

  const chosenManual = manual.includes(manualStatus as Status)
    ? (manualStatus as Status)
    : manual[0];

  return (
    <div className="space-y-4">
      {canClose ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAttemptedClose(true);
            if (!outcome.trim()) return;
            transition.mutate({ to_status: 'closed', note: outcome.trim() });
          }}
          className="space-y-2"
        >
          <label className="block">
            <span className="block text-[12.5px] font-medium text-ink-2 mb-1">
              Outcome note <span className="text-neg">*</span>
            </span>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. Hired as L5, start date Oct 6 · Not moving forward after onsite"
              className="textarea-field w-full text-[13px]"
              maxLength={2000}
              aria-invalid={attemptedClose && !outcome.trim()}
            />
          </label>
          {attemptedClose && !outcome.trim() ? (
            <p role="alert" className="text-[12px] text-neg">
              Add a short outcome so the pipeline stays explainable.
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={transition.isPending}>
            {transition.isPending && transition.variables?.to_status === 'closed'
              ? 'Closing…'
              : 'Close request'}
          </Button>
        </form>
      ) : null}

      {manual.length > 0 ? (
        <Disclosure summary="Record update manually">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chosenManual) return;
              transition.mutate({
                to_status: chosenManual,
                note: manualNote.trim() || null,
                reason: chosenManual === 'employee_declined' ? reason : null,
              });
            }}
            className="space-y-2 rounded bg-ground border border-line p-3"
          >
            <p className="text-[12px] text-muted">
              Use this when the employee told you something outside Slack.
            </p>
            <label className="block">
              <span className="block text-[12.5px] font-medium text-ink-2 mb-1">New status</span>
              <select
                value={chosenManual ?? ''}
                onChange={(e) => setManualStatus(e.target.value as Status)}
                className="field w-full text-[13px]"
              >
                {manual.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            {chosenManual === 'employee_declined' ? (
              <label className="block">
                <span className="block text-[12.5px] font-medium text-ink-2 mb-1">Reason</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as DeclineReason)}
                  className="field w-full text-[13px]"
                >
                  {(Object.keys(DECLINE_REASON_LABELS) as DeclineReason[]).map((k) => (
                    <option key={k} value={k}>
                      {DECLINE_REASON_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className="block text-[12.5px] font-medium text-ink-2 mb-1">
                Note <span className="text-muted font-normal">(optional)</span>
              </span>
              <textarea
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                className="textarea-field w-full text-[13px] min-h-[60px]"
                maxLength={2000}
              />
            </label>
            <Button type="submit" disabled={transition.isPending || !chosenManual}>
              {transition.isPending && transition.variables?.to_status !== 'closed'
                ? 'Saving…'
                : 'Record update'}
            </Button>
          </form>
        </Disclosure>
      ) : null}

      {errorText ? (
        <p role="alert" className="text-[12.5px] text-neg">
          {errorText}
        </p>
      ) : null}
      {transition.isSuccess ? (
        <p className="text-[12.5px] text-pos" aria-live="polite">
          Updated to {STATUS_LABELS[transition.data.status]}.
        </p>
      ) : null}
    </div>
  );
}
