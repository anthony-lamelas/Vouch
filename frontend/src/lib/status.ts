import type { Status } from '../api/types';

export type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'info';

export const STATUS_ORDER: readonly Status[] = [
  'requested',
  'employee_accepted',
  'employee_declined',
  'candidate_interested',
  'candidate_declined',
  'closed',
];

/** Labels are written from the recruiter's point of view. Keep in sync with backend LABELS. */
export const STATUS_LABELS: Record<Status, string> = {
  requested: 'Waiting on employee',
  employee_accepted: 'Employee reached out',
  employee_declined: 'Employee passed',
  candidate_interested: 'Candidate interested',
  candidate_declined: 'Candidate passed',
  closed: 'Closed',
};

/** Maps onto the semantic tag colours in docs/design/attio-style.md. */
export const STATUS_TONES: Record<Status, Tone> = {
  requested: 'warning',
  employee_accepted: 'info',
  employee_declined: 'negative',
  candidate_interested: 'positive',
  candidate_declined: 'negative',
  closed: 'neutral',
};

/** Human sentence for a timeline event, to follow the actor's name. */
export function eventSentence(from: Status | null, to: Status, contactFirstName: string): string {
  if (from === to && to === 'employee_accepted') return 'sent a nudge';
  switch (to) {
    case 'requested':
      return from === 'employee_declined' ? 're-routed the request' : 'opened the request';
    case 'employee_accepted':
      return 'agreed to reach out';
    case 'employee_declined':
      return 'passed on referring';
    case 'candidate_interested':
      return `reports ${contactFirstName} is interested`;
    case 'candidate_declined':
      return `reports ${contactFirstName} passed`;
    case 'closed':
      return 'closed the request';
  }
}

export function isStatus(value: string): value is Status {
  return (STATUS_ORDER as readonly string[]).includes(value);
}

/** Days after the employee agreed to reach out before silence is flagged. Mirrors the backend. */
export const STALE_AFTER_DAYS = 7;
