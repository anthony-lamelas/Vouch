import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  useContact,
  useNudgeRequest,
  useRequest,
  useRerouteRequest,
  useTransitionRequest,
} from '../api/queries';
import type { EventOut, RequestDetail, Status } from '../api/types';
import { Button } from '../components/Button';
import { ErrorState, Skeleton } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Popover } from '../components/Popover';
import { ProfileBlocks } from '../components/ProfileBlocks';
import { StatusPill } from '../components/StatusPill';
import { Tabs } from '../components/Tabs';
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
  const [tab, setTab] = useState<'timeline' | 'candidate'>('timeline');

  return (
    <div>
      <PageHeader
        title={
          <span className="truncate">
            {r.contact.full_name} for {r.role.title}
          </span>
        }
      >
        <Actions r={r} employeeFirst={employeeFirst} contactFirst={contactFirst} />
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
          <div className="mt-4 flex h-9 items-stretch border-b border-line">
            <Tabs
              label="Request detail"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'timeline', label: 'Timeline', count: events.length },
                { value: 'candidate', label: 'Candidate' },
              ]}
            />
          </div>
          {tab === 'timeline' ? (
            <Timeline r={r} events={events} contactFirst={contactFirst} />
          ) : (
            <CandidateProfile r={r} />
          )}
        </section>
      </div>
    </div>
  );
}

/** Events as blocks on a rail: sentence, time, then any note or the message that went out. */
function Timeline({
  r,
  events,
  contactFirst,
}: {
  r: RequestDetail;
  events: EventOut[];
  contactFirst: string;
}) {
  const employeeFirst = firstName(r.employee.full_name);
  // The ask text belongs to whoever was asked last: the opening event, or the latest re-route.
  const opened = [...events].reverse().find((e) => e.to_status === 'requested');
  return (
    <ol className="mt-4 flex flex-col gap-5" aria-label="Timeline">
      {events.map((e, i) => {
        const latest = i === events.length - 1;
        const showMessage = e.id === opened?.id && r.outreach_casual.trim() !== '';
        return (
          <li key={e.id} className="relative pl-6">
            {!latest ? (
              <span
                aria-hidden
                className="absolute left-[4.5px] top-[18px] -bottom-5 w-px bg-line"
              />
            ) : null}
            <span
              aria-hidden
              className={`absolute left-0 top-[5px] size-2.5 rounded-full ring-2 ring-canvas ${
                latest ? 'bg-cobalt' : 'bg-line'
              }`}
            />
            <div className="flex items-baseline justify-between gap-4 text-[14px] leading-5">
              <p className="min-w-0 text-carbon">
                <span className="font-semibold text-ink">{e.actor_label}</span>{' '}
                {eventSentence(e.from_status, e.to_status, contactFirst)}
              </p>
              <time
                dateTime={e.created_at}
                title={formatDateTime(e.created_at)}
                className="shrink-0 whitespace-nowrap text-[12px] tracking-normal text-muted tnum"
              >
                {formatRelative(e.created_at)}
              </time>
            </div>
            {e.note ? (
              <div className="mt-2 rounded-[10px] bg-haze px-3 py-2.5 text-[13px] leading-5 text-carbon">
                {e.note}
              </div>
            ) : null}
            {showMessage ? (
              <div className="mt-2 rounded-[10px] bg-haze px-3 py-2.5">
                <p className="text-[12px] tracking-normal text-muted">
                  Message sent to {employeeFirst}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-carbon">
                  {r.outreach_casual}
                </p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The candidate's full profile, fetched separately: the request only carries a brief. */
function CandidateProfile({ r }: { r: RequestDetail }) {
  const contact = useContact(r.contact.id);
  return (
    <section aria-labelledby="candidate-title" className="mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 id="candidate-title" className="sr-only">
          Candidate
        </h2>
        <Link
          to={`/roles/${r.role.id}?contact=${r.contact.id}`}
          className="link text-[12px] tracking-normal"
        >
          Open profile
        </Link>
      </div>
      {contact.isError ? (
        <ErrorState title="Couldn't load the candidate's profile" error={contact.error} />
      ) : null}
      {contact.isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading profile">
          <Skeleton className="h-3.5 w-[60%]" />
          <Skeleton className="h-3.5 w-[45%]" />
          <Skeleton className="h-3.5 w-[52%]" />
        </div>
      ) : null}
      {contact.data ? (
        <div className="space-y-4">
          <ProfileBlocks
            experiences={contact.data.experiences}
            education={contact.data.education}
            skills={contact.data.skills}
          />
        </div>
      ) : null}
    </section>
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
        <Row label="Candidate">{r.contact.full_name}</Row>
        <Row label="Current role">
          {r.contact.current_title} at {r.contact.current_company}
        </Row>
        <Row label="Location">{r.contact.location}</Row>
        <Row label="Role">
          <a href={r.role.job_url} target="_blank" rel="noreferrer" className="link">
            {r.role.title}
          </a>
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
      <details className="group mt-4 border-t border-line pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
            ›
          </span>
          Why this candidate
        </summary>
        {r.reasons.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">No stored match signals for this pair.</p>
        ) : (
          <dl className="mt-1 divide-y divide-line">
            {r.reasons.map((reason, i) => (
              <div
                key={i}
                className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-x-3 py-[7px]"
              >
                <dt className="text-[12px] leading-[18px] tracking-normal text-muted">
                  {reason.label}
                </dt>
                <dd className="min-w-0 text-[13px] leading-[18px] font-medium text-ink">
                  {reason.detail ?? '—'}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </details>
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
    `Asked ${employeeFirst} to reach out`,
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

function Actions({
  r,
  employeeFirst,
  contactFirst,
}: {
  r: RequestDetail;
  employeeFirst: string;
  contactFirst: string;
}) {
  const nudge = useNudgeRequest(r.id);
  const transition = useTransitionRequest(r.id);
  const reroute = useRerouteRequest(r.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<'close' | 'more' | 'reroute' | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const [outcome, setOutcome] = useState('');
  const [attemptedClose, setAttemptedClose] = useState(false);
  const [nextEmployee, setNextEmployee] = useState<string | null>(null);
  const declined = r.status === 'employee_declined';
  const bookingSent = r.events.some(
    (e) => e.from_status === 'candidate_interested' && e.to_status === 'candidate_interested',
  );
  // Asking someone else has its own flow; "requested" is not a status to record by hand.
  const manual: Status[] = r.allowed_transitions.filter((s) => s !== 'closed' && s !== 'requested');
  const [manualStatus, setManualStatus] = useState<Status | ''>('');
  const [manualNote, setManualNote] = useState('');
  const canClose = r.allowed_transitions.includes('closed');

  const err = transition.error;
  const errorText = err instanceof ApiError ? err.detail : err ? err.message : null;

  if (r.status === 'closed') {
    return (
      <span className="text-[13px] text-muted">
        Closed {formatRelative(r.last_event_at ?? r.updated_at)}
      </span>
    );
  }

  const chosenManual: Status | undefined =
    manualStatus && manual.includes(manualStatus) ? manualStatus : manual[0];
  const chosenNext: string | null =
    nextEmployee && r.alternatives.some((a) => a.employee.id === nextEmployee)
      ? nextEmployee
      : (r.alternatives[0]?.employee.id ?? null);
  const rerouteErr = reroute.error;
  const rerouteErrorText =
    rerouteErr instanceof ApiError ? rerouteErr.detail : rerouteErr ? rerouteErr.message : null;

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
      {r.status === 'candidate_interested' ? (
        <>
          <span className="text-[13px] font-medium text-yes-text">
            {contactFirst} is interested.
            {bookingSent ? ` ${employeeFirst} has the booking link to pass on.` : ''}
          </span>
          <Button
            variant="primary"
            size="sm"
            disabled={transition.isPending}
            onClick={() => transition.mutate({ to_status: 'closed', note: 'Interview scheduled' })}
          >
            {transition.isPending && transition.variables?.note === 'Interview scheduled'
              ? 'Saving'
              : 'Interview scheduled'}
          </Button>
        </>
      ) : null}
      {declined ? (
        <span className="text-[13px] font-medium text-needs-text">
          {employeeFirst} passed.{' '}
          {r.alternatives.length > 0
            ? `${r.alternatives.length} other ${r.alternatives.length === 1 ? 'colleague knows' : 'colleagues know'} ${contactFirst}.`
            : `No one else at Cognition knows ${contactFirst}.`}
        </span>
      ) : null}
      {declined && r.alternatives.length > 0 ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => setPanel((p) => (p === 'reroute' ? null : 'reroute'))}
          aria-expanded={panel === 'reroute'}
          aria-haspopup="dialog"
          disabled={reroute.isPending}
        >
          Ask someone else
        </Button>
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
      {!r.stale && !declined && manual.length > 0 ? (
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
        open={panel === 'reroute'}
        onClose={closePanel}
        rootRef={rootRef}
        label="Ask someone else"
        className="w-[400px]"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            reroute.mutate({ employee_id: chosenNext }, { onSuccess: closePanel });
          }}
          className="space-y-2"
        >
          <p className="text-[12px] font-medium tracking-normal text-carbon">
            Who should reach out to {contactFirst} instead?
          </p>
          <ul className="max-h-[260px] space-y-1 overflow-y-auto" role="radiogroup">
            {r.alternatives.map((alt) => {
              const selected = alt.employee.id === chosenNext;
              return (
                <li key={alt.employee.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-[8px] px-2 py-1.5 ${
                      selected ? 'bg-haze' : 'hover:bg-haze/70'
                    }`}
                  >
                    <input
                      type="radio"
                      name="next-employee"
                      value={alt.employee.id}
                      checked={selected}
                      onChange={() => setNextEmployee(alt.employee.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">
                        {alt.employee.full_name}
                        <span className="font-medium text-muted"> · {alt.employee.title}</span>
                      </span>
                      {alt.shared_history ? (
                        <span className="block text-[12px] tracking-normal text-muted">
                          {alt.shared_history}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {rerouteErrorText ? (
            <p role="alert" className="text-[12px] text-no-text">
              {rerouteErrorText}. Try again.
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={reroute.isPending || !chosenNext}
            >
              {reroute.isPending ? 'Sending' : 'Send request'}
            </Button>
            <Button variant="ghost" size="sm" onClick={closePanel}>
              Cancel
            </Button>
          </div>
        </form>
      </Popover>

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
