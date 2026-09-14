import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useNudgeRequest, useRequest, useTransitionRequest } from '../api/queries';
import type { EventOut, RequestDetail, Status } from '../api/types';
import { Button } from '../components/Button';
import { Disclosure } from '../components/Disclosure';
import { ErrorState, Skeleton } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Popover } from '../components/Popover';
import { StatusPill } from '../components/StatusPill';
import { firstName, formatDate, formatDateTime, formatRelative } from '../lib/format';
import { STATUS_LABELS, eventSentence } from '../lib/status';

export function RequestPage() {
  const { id = '' } = useParams();
  const request = useRequest(id);

  if (request.isPending) {
    return (
      <div>
        <div className="flex h-[52px] items-center border-b border-line">
          <Skeleton className="h-5 w-[460px]" />
        </div>
        <div className="mt-4 grid grid-cols-[320px_minmax(0,1fr)] gap-6">
          <Skeleton className="h-[320px] w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
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
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="truncate">
              {r.contact.full_name} for {r.role.title}
            </span>
            <StatusPill status={r.status} />
          </span>
        }
      >
        <Actions r={r} employeeFirst={employeeFirst} />
      </PageHeader>

      <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Attributes r={r} />

        <section className="min-w-0">
          <Stepper
            r={r}
            events={events}
            contactFirst={contactFirst}
            employeeFirst={employeeFirst}
          />
          <h2 className="mt-5 text-[13px] font-semibold text-ink">Timeline</h2>
          <ol className="mt-1">
            {events.map((e, i) => {
              const latest = i === events.length - 1;
              return (
                <li
                  key={e.id}
                  className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-2.5 border-b border-line py-2 text-[13px]"
                >
                  <span
                    aria-hidden
                    className={`mt-[7px] size-1.5 rounded-full ${latest ? 'bg-cobalt' : 'bg-line'}`}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-ink">{e.actor_label}</span>{' '}
                    <span className="text-carbon">
                      {eventSentence(e.from_status, e.to_status, contactFirst)}
                    </span>
                    {e.note ? (
                      <blockquote className="mt-1 border-l-2 border-line pl-2 text-[12px] tracking-normal text-muted">
                        “{e.note}”
                      </blockquote>
                    ) : null}
                  </div>
                  <time
                    dateTime={e.created_at}
                    title={e.created_at}
                    className="whitespace-nowrap text-[12px] tracking-normal text-muted tnum"
                  >
                    {formatDateTime(e.created_at)}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-x-3 py-[7px]">
      <dt className="text-[12px] leading-[18px] tracking-normal text-muted">{label}</dt>
      <dd className="min-w-0 text-[13px] leading-[18px] font-medium text-ink">{children}</dd>
    </div>
  );
}

/** Attio-style attribute panel. */
function Attributes({ r }: { r: RequestDetail }) {
  return (
    <aside className="rounded-card bg-paper p-4">
      <dl className="divide-y divide-line">
        <Row label="Status">
          <StatusPill status={r.status} />
        </Row>
        <Row label="Candidate">
          <Link to={`/roles/${r.role.id}?contact=${r.contact.id}`} className="link">
            {r.contact.full_name}
          </Link>
        </Row>
        <Row label="Current role">
          {r.contact.current_title} at {r.contact.current_company}
        </Row>
        <Row label="Location">{r.contact.location}</Row>
        <Row label="Role">
          <Link to={`/roles/${r.role.id}`} className="link">
            {r.role.title}
          </Link>
        </Row>
        <Row label="Team">{r.role.team}</Row>
        <Row label="Employee asked">
          {r.employee.full_name}
          <span className="block text-[12px] font-medium tracking-normal text-muted">
            {r.employee.title}
            {r.employee.team ? `, ${r.employee.team}` : ''}
          </span>
        </Row>
        <Row label="Their connection">
          {r.connection ? (
            <>
              {r.connection.shared_history ? (
                <span className="block text-[12px] font-medium tracking-normal text-muted">
                  {r.connection.shared_history}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-muted">—</span>
          )}
        </Row>
        <Row label="Requested by">
          <span title={r.requested_by}>{r.requested_by_name}</span>
        </Row>
        <Row label="Asked on">
          <span className="tnum" title={r.created_at}>
            {formatDate(r.created_at)}
          </span>
        </Row>
        <Row label="Last activity">
          <span className="tnum" title={r.last_event_at ?? r.updated_at}>
            {formatRelative(r.last_event_at ?? r.updated_at)}
          </span>
        </Row>
      </dl>
      <Disclosure summary="Why this candidate" className="mt-3 border-t border-line pt-3">
        {r.reasons.length === 0 ? (
          <p className="text-[13px] text-muted">No stored match signals for this pair.</p>
        ) : (
          <dl className="divide-y divide-line text-[13px]">
            {r.reasons.map((reason, i) => (
              <div key={i} className="py-1.5">
                <dt className="font-medium text-ink">{reason.label}</dt>
                {reason.detail ? (
                  <dd className="text-[12px] tracking-normal text-muted">{reason.detail}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        )}
      </Disclosure>
    </aside>
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

const CURRENT_FILL = [
  'bg-wait-bg text-wait-text',
  'bg-reach-bg text-reach-text',
  'bg-yes-bg text-yes-text',
  'bg-closed-bg text-closed-text',
] as const;

function segmentClass(i: number, s: Step): string {
  if (s.state === 'future') return 'bg-haze text-caption';
  if (s.note?.endsWith('passed')) return 'bg-no-bg text-no-text';
  if (s.state === 'current') return CURRENT_FILL[i] ?? 'bg-ice text-reach-text';
  if (i === 3) return 'bg-closed-bg text-closed-text';
  return 'bg-ice text-reach-text';
}

/** Four 28px segments, filled in the semantic colours for done and current, haze for future. */
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
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Progress">
      {steps.map((s, i) => (
        <li
          key={s.label}
          aria-current={s.state === 'current' ? 'step' : undefined}
          title={s.when ? `${s.label} · ${formatDateTime(s.when)}` : s.label}
          className={`flex h-7 min-w-0 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium tracking-normal ${segmentClass(i, s)}`}
        >
          <span className="truncate">{s.note ?? s.label}</span>
          {s.when ? (
            <span className="ml-auto shrink-0 text-[11px] opacity-70 tnum">
              {formatDate(s.when).replace(/, \d{4}$/, '')}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Actions({ r, employeeFirst }: { r: RequestDetail; employeeFirst: string }) {
  const nudge = useNudgeRequest(r.id);
  const transition = useTransitionRequest(r.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<'close' | 'more' | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
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
      <span className="text-[13px] text-muted">
        Closed {formatRelative(r.last_event_at ?? r.updated_at)}
        {r.closed_outcome ? (
          <>
            {' '}
            · <span className="text-ink">“{r.closed_outcome}”</span>
          </>
        ) : null}
      </span>
    );
  }

  const chosenManual: Status | undefined =
    manualStatus && manual.includes(manualStatus) ? manualStatus : manual[0];

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      {nudge.isError ? (
        <span role="alert" className="text-[12px] text-no-text">
          The nudge didn't send. Try again.
        </span>
      ) : nudge.isSuccess ? (
        <span className="text-[12px] text-muted" aria-live="polite">
          Nudged {employeeFirst}.
        </span>
      ) : null}
      {errorText && !panel ? (
        <span role="alert" className="text-[12px] text-no-text">
          {errorText}. Try again.
        </span>
      ) : null}

      {r.stale ? (
        <span className="text-[13px] font-medium text-needs-text">
          No reply from {r.contact.full_name.split(' ')[0]} in {r.days_waiting} days.
        </span>
      ) : null}
      {r.stale ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => nudge.mutate()}
          disabled={nudge.isPending}
        >
          {nudge.isPending ? 'Sending' : `Nudge ${employeeFirst}`}
        </Button>
      ) : null}
      {canClose ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPanel((p) => (p === 'close' ? null : 'close'))}
          aria-expanded={panel === 'close'}
          disabled={transition.isPending}
        >
          Close request
        </Button>
      ) : null}
      {!r.stale && manual.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPanel((p) => (p === 'more' ? null : 'more'))}
          aria-expanded={panel === 'more'}
          aria-haspopup="dialog"
        >
          More
        </Button>
      ) : null}

      <Popover
        open={panel === 'close'}
        onClose={closePanel}
        rootRef={rootRef}
        label="Close request"
        className="w-[360px]"
      >
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
            <span className="mb-1 block text-[12px] font-medium tracking-normal text-carbon">
              Outcome, so the pipeline stays explainable
            </span>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Hired as L5, starts Oct 6"
              className="textarea-field min-h-[64px] w-full text-[13px]"
              maxLength={2000}
              aria-invalid={attemptedClose && !outcome.trim()}
              autoFocus
            />
          </label>
          {attemptedClose && !outcome.trim() ? (
            <p role="alert" className="text-[12px] text-no-text">
              Add a short outcome before closing.
            </p>
          ) : null}
          {errorText ? (
            <p role="alert" className="text-[12px] text-no-text">
              {errorText}. Try again.
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={transition.isPending}>
              {transition.isPending && transition.variables?.to_status === 'closed'
                ? 'Closing'
                : 'Close request'}
            </Button>
            <Button variant="ghost" size="sm" onClick={closePanel}>
              Cancel
            </Button>
          </div>
        </form>
      </Popover>

      <Popover
        open={panel === 'more'}
        onClose={closePanel}
        rootRef={rootRef}
        label="Record an update"
        className="w-[360px]"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!chosenManual) return;
            transition.mutate(
              { to_status: chosenManual, note: manualNote.trim() || null, reason: null },
              { onSuccess: closePanel },
            );
          }}
          className="space-y-2"
        >
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium tracking-normal text-carbon">
              Record what {employeeFirst} told you outside Slack
            </span>
            <select
              value={chosenManual ?? ''}
              onChange={(e) => setManualStatus(e.target.value as Status)}
              className="field h-8 w-full text-[13px]"
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
            className="field h-8 w-full text-[13px]"
            maxLength={2000}
          />
          {errorText ? (
            <p role="alert" className="text-[12px] text-no-text">
              {errorText}. Try again.
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={transition.isPending || !chosenManual}
            >
              {transition.isPending && transition.variables?.to_status !== 'closed'
                ? 'Saving'
                : 'Record update'}
            </Button>
            <Button variant="ghost" size="sm" onClick={closePanel}>
              Cancel
            </Button>
          </div>
        </form>
      </Popover>
    </div>
  );
}
