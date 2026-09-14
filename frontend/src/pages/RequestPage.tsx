import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useNudgeRequest, useRequest, useTransitionRequest } from '../api/queries';
import type { EventOut, RequestDetail, Status } from '../api/types';
import { Button } from '../components/Button';
import { CopyButton } from '../components/CopyButton';
import { DeliveryMark } from '../components/DeliveryMark';
import { Disclosure } from '../components/Disclosure';
import { ErrorState, Skeleton } from '../components/EmptyState';
import { StrengthBar } from '../components/StrengthBar';
import { firstName, formatDate, formatDateTime, formatRelative } from '../lib/format';
import { STATUS_LABELS, eventSentence } from '../lib/status';

export function RequestPage() {
  const { id = '' } = useParams();
  const request = useRequest(id);

  if (request.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-[460px]" />
        <Skeleton className="h-4 w-[320px]" />
        <Skeleton className="mt-6 h-16 w-full" />
      </div>
    );
  }
  if (request.isError) {
    return <ErrorState title="Couldn't load this request" error={request.error} />;
  }
  return <RequestView r={request.data} />;
}

function RequestView({ r }: { r: RequestDetail }) {
  const contactFirst = firstName(r.contact.full_name);
  const employeeFirst = firstName(r.employee.full_name);
  const events = useMemo(
    () =>
      [...r.events].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [r.events],
  );

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-serif text-[28px] font-medium leading-[1.15] tracking-[-0.01em] text-ink">
          <Link to={`/roles/${r.role.id}?contact=${r.contact.id}`} className="hover:underline">
            {r.contact.full_name}
          </Link>
          <span className="font-normal italic text-ink-2"> for </span>
          <Link to={`/roles/${r.role.id}`} className="font-normal italic hover:underline">
            {r.role.title}
          </Link>
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-2">
          Asked {r.employee.full_name} · requested by {r.requested_by_name} ·{' '}
          <span className="tnum" title={r.created_at}>
            {formatDate(r.created_at)}
          </span>
        </p>
      </header>

      <Stepper r={r} events={events} contactFirst={contactFirst} employeeFirst={employeeFirst} />

      <ActionRow r={r} contactFirst={contactFirst} employeeFirst={employeeFirst} />

      <div className="mt-8 grid grid-cols-1 items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <section aria-labelledby="timeline-title" className="min-w-0">
          <h2 id="timeline-title" className="mb-1 text-[14px] font-semibold text-ink">
            Timeline
          </h2>
          <ol>
            {events.map((e, i) => {
              const latest = i === events.length - 1;
              return (
                <li
                  key={e.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 border-b border-line py-3 ${
                    latest ? 'border-l-2 border-l-spruce pl-3' : 'pl-[14px]'
                  }`}
                >
                  <div className="min-w-0 text-[14px] text-ink">
                    <span className="font-medium">{e.actor_label}</span>{' '}
                    {eventSentence(e.from_status, e.to_status, contactFirst)}
                    {e.note ? (
                      <blockquote className="mt-1 border-l-2 border-line-strong pl-2.5 text-[13.5px] text-ink-2">
                        “{e.note}”
                      </blockquote>
                    ) : null}
                  </div>
                  <time
                    dateTime={e.created_at}
                    title={e.created_at}
                    className="whitespace-nowrap text-right text-[13px] text-muted tnum"
                  >
                    {formatDateTime(e.created_at)}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="space-y-6 text-[14px]">
          <section>
            <h3 className="mb-1 text-[13px] font-medium text-muted">Candidate</h3>
            <Link
              to={`/roles/${r.role.id}?contact=${r.contact.id}`}
              className="name hover:underline"
            >
              {r.contact.full_name}
            </Link>
            <div className="mt-0.5 text-ink-2">
              {r.contact.current_title} at {r.contact.current_company}
            </div>
            <div className="text-muted">{r.contact.location}</div>
          </section>

          <section>
            <h3 className="mb-1 text-[13px] font-medium text-muted">Employee</h3>
            <div className="font-medium text-ink">{r.employee.full_name}</div>
            <div className="text-ink-2">
              {r.employee.title}
              {r.employee.team ? `, ${r.employee.team}` : ''}
            </div>
            {r.connection ? (
              <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
                <StrengthBar value={r.connection.strength} />
                {r.connection.shared_history ? <span>{r.connection.shared_history}</span> : null}
              </div>
            ) : null}
          </section>

          <Disclosure summary="Why this candidate">
            {r.reasons.length === 0 ? (
              <p className="text-muted">No stored match signals for this pair.</p>
            ) : (
              <ul className="space-y-1">
                {r.reasons.map((reason, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-ink">{reason.label}</span>
                    {reason.detail ? (
                      <span className="text-[13px] text-muted">{reason.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Disclosure>

          <Disclosure summary={`What ${employeeFirst} received`}>
            <div className="space-y-4">
              {r.messages.length === 0 ? (
                <div>
                  <p className="mb-1 text-[13px] text-muted">Draft, not yet sent</p>
                  <MessageBody text={r.outreach_casual} />
                </div>
              ) : (
                r.messages.map((m) => (
                  <div key={m.id}>
                    <MessageBody text={m.body} />
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <DeliveryMark delivered={m.delivered} error={m.error} channel={m.channel} />
                      <time
                        dateTime={m.created_at}
                        title={m.created_at}
                        className="text-[13px] text-muted tnum"
                      >
                        {formatDateTime(m.created_at)}
                      </time>
                    </div>
                  </div>
                ))
              )}
              <Disclosure summary="Email version">
                <MessageBody text={r.outreach_formal} />
                <div className="mt-2">
                  <CopyButton text={r.outreach_formal} label="Copy email" />
                </div>
              </Disclosure>
            </div>
          </Disclosure>
        </aside>
      </div>
    </div>
  );
}

function MessageBody({ text }: { text: string }) {
  return (
    <pre className="m-0 whitespace-pre-wrap border-l-2 border-line-strong pl-3 font-sans text-[13.5px] leading-relaxed text-ink-2">
      {text}
    </pre>
  );
}

interface Step {
  label: string;
  state: 'done' | 'current' | 'future';
  when: string | null;
  note?: string;
}

function firstEventTo(events: EventOut[], statuses: Status[]): EventOut | undefined {
  return events.find((e) => statuses.includes(e.to_status));
}

function buildSteps(
  r: RequestDetail,
  events: EventOut[],
  contactFirst: string,
  employeeFirst: string,
): Step[] {
  const asked = firstEventTo(events, ['requested']);
  const reached = firstEventTo(events, ['employee_accepted']);
  const answered = firstEventTo(events, ['candidate_interested', 'candidate_declined']);
  const closed = firstEventTo(events, ['closed']);

  const stage: number =
    r.status === 'closed'
      ? 4
      : r.status === 'candidate_interested' || r.status === 'candidate_declined'
        ? 2
        : r.status === 'employee_accepted'
          ? 1
          : 0;

  const labels = [
    'Asked',
    `${employeeFirst} reached out`,
    `${contactFirst} answered`,
    'Closed',
  ] as const;
  const whens = [asked, reached, answered, closed].map((e) => e?.created_at ?? null);

  return labels.map((label, i) => {
    let state: Step['state'] = i < stage ? 'done' : i === stage ? 'current' : 'future';
    if (stage === 4) state = 'done';
    const step: Step = { label, state, when: whens[i] ?? null };
    if (i === 0 && r.status === 'employee_declined') {
      step.state = 'done';
      step.note = `${employeeFirst} passed`;
    }
    if (i === 2 && r.status === 'candidate_declined') step.note = `${contactFirst} passed`;
    if (i === 2 && r.status === 'candidate_interested') step.note = `${contactFirst} is interested`;
    return step;
  });
}

function Stepper({
  r,
  events,
  contactFirst,
  employeeFirst,
}: {
  r: RequestDetail;
  events: EventOut[];
  contactFirst: string;
  employeeFirst: string;
}) {
  const steps = buildSteps(r, events, contactFirst, employeeFirst);
  const rule: Record<Step['state'], string> = {
    done: 'border-ink',
    current: 'border-spruce',
    future: 'border-line-strong',
  };
  const text: Record<Step['state'], string> = {
    done: 'text-ink',
    current: 'text-spruce font-medium',
    future: 'text-muted',
  };
  return (
    <ol className="grid grid-cols-4 gap-3" aria-label="Progress">
      {steps.map((s) => (
        <li
          key={s.label}
          aria-current={s.state === 'current' ? 'step' : undefined}
          className={`border-t-2 pt-2 ${rule[s.state]}`}
        >
          <div className={`text-[14px] ${text[s.state]}`}>{s.label}</div>
          {s.note ? (
            <div
              className={`text-[13px] ${s.note.endsWith('passed') ? 'text-neg' : 'text-spruce-ink'}`}
            >
              {s.note}
            </div>
          ) : null}
          {s.when ? (
            <div className="text-[13px] text-muted tnum" title={s.when}>
              {formatDate(s.when)}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ActionRow({
  r,
  contactFirst,
  employeeFirst,
}: {
  r: RequestDetail;
  contactFirst: string;
  employeeFirst: string;
}) {
  const nudge = useNudgeRequest(r.id);
  const transition = useTransitionRequest(r.id);
  const [closing, setClosing] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [attemptedClose, setAttemptedClose] = useState(false);
  const manual: Status[] = r.allowed_transitions.filter((s) => s !== 'closed');
  const [manualStatus, setManualStatus] = useState<Status | ''>('');
  const [manualNote, setManualNote] = useState('');
  const canClose = r.allowed_transitions.includes('closed');

  const err = transition.error;
  const errorText = err instanceof ApiError ? err.detail : err ? err.message : null;

  if (r.status === 'closed') {
    return (
      <div className="mt-4 border-b border-line pb-4 text-[14px] text-ink-2">
        Closed {formatRelative(r.last_event_at ?? r.updated_at)}
        {r.closed_outcome ? (
          <>
            {' '}
            with the outcome <span className="text-ink">“{r.closed_outcome}”</span>
          </>
        ) : (
          '.'
        )}
      </div>
    );
  }

  const chosenManual: Status | undefined =
    manualStatus && manual.includes(manualStatus) ? manualStatus : manual[0];

  return (
    <div className="mt-4 border-b border-line pb-4">
      <div className="flex flex-wrap items-center gap-3">
        {r.stale ? (
          <>
            <p className="text-[14px] font-medium text-ochre">
              No reply from {contactFirst} in {r.days_waiting ?? 0} days.
            </p>
            <Button variant="primary" onClick={() => nudge.mutate()} disabled={nudge.isPending}>
              {nudge.isPending ? 'Sending' : `Nudge ${employeeFirst}`}
            </Button>
          </>
        ) : null}
        {canClose ? (
          <Button
            variant="secondary"
            onClick={() => setClosing((v) => !v)}
            aria-expanded={closing}
            disabled={transition.isPending}
          >
            Close request
          </Button>
        ) : null}
        {!r.stale && manual.length > 0 ? (
          <Disclosure summary="More" className="ml-1">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!chosenManual) return;
                transition.mutate({
                  to_status: chosenManual,
                  note: manualNote.trim() || null,
                  reason: null,
                });
              }}
              className="flex max-w-[560px] flex-wrap items-end gap-3"
            >
              <label className="block">
                <span className="mb-1 block text-[13px] text-muted">
                  Record what {employeeFirst} told you outside Slack
                </span>
                <select
                  value={chosenManual ?? ''}
                  onChange={(e) => setManualStatus(e.target.value as Status)}
                  className="field pr-7 text-[14px]"
                >
                  {manual.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <input
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Note"
                className="field w-[240px] text-[14px]"
                maxLength={2000}
              />
              <Button type="submit" disabled={transition.isPending || !chosenManual}>
                {transition.isPending && transition.variables?.to_status !== 'closed'
                  ? 'Saving'
                  : 'Record update'}
              </Button>
            </form>
          </Disclosure>
        ) : null}
        {nudge.isError ? (
          <p role="alert" className="text-[13.5px] text-neg">
            The nudge didn't send. Try again.
          </p>
        ) : null}
        {nudge.isSuccess ? (
          <p className="text-[13.5px] text-ink-2" aria-live="polite">
            Nudged {employeeFirst}.
          </p>
        ) : null}
      </div>

      {closing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAttemptedClose(true);
            if (!outcome.trim()) return;
            transition.mutate({ to_status: 'closed', note: outcome.trim() });
          }}
          className="mt-3 max-w-[560px] space-y-2"
        >
          <label className="block">
            <span className="mb-1 block text-[13.5px] font-medium text-ink-2">
              Outcome, so the pipeline stays explainable
            </span>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Hired as L5, starts Oct 6"
              className="textarea-field min-h-[64px] w-full text-[14px]"
              maxLength={2000}
              aria-invalid={attemptedClose && !outcome.trim()}
              autoFocus
            />
          </label>
          {attemptedClose && !outcome.trim() ? (
            <p role="alert" className="text-[13px] text-neg">
              Add a short outcome before closing.
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" disabled={transition.isPending}>
              {transition.isPending && transition.variables?.to_status === 'closed'
                ? 'Closing'
                : 'Close request'}
            </Button>
            <Button variant="ghost" onClick={() => setClosing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {errorText ? (
        <p role="alert" className="mt-2 text-[13.5px] text-neg">
          {errorText}. Try again.
        </p>
      ) : null}
    </div>
  );
}
