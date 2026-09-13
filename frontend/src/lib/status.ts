import type { Status } from '../api/types';

export type Tone = 'neutral' | 'positive' | 'warning' | 'negative';

export const STATUS_ORDER: readonly Status[] = [
  'requested',
  'employee_accepted',
  'employee_declined',
  'candidate_interested',
  'candidate_declined',
  'no_response',
  'closed',
];

/** Labels are written from the recruiter's point of view. Keep in sync with backend LABELS. */
export const STATUS_LABELS: Record<Status, string> = {
  requested: 'Waiting on employee',
  employee_accepted: 'Employee reaching out',
  employee_declined: 'Employee passed',
  candidate_interested: 'Candidate interested',
  candidate_declined: 'Candidate passed',
  no_response: 'No reply yet',
  closed: 'Closed',
};

export const STATUS_TONES: Record<Status, Tone> = {
  requested: 'neutral',
  employee_accepted: 'positive',
  employee_declined: 'negative',
  candidate_interested: 'positive',
  candidate_declined: 'negative',
  no_response: 'warning',
  closed: 'neutral',
};

/** Human sentence for a timeline event, to follow the actor's name. */
export function eventSentence(from: Status | null, to: Status, contactFirstName: string): string {
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
    case 'no_response':
      return `reports no reply from ${contactFirstName}`;
    case 'closed':
      return 'closed the request';
  }
}

export function isStatus(value: string): value is Status {
  return (STATUS_ORDER as readonly string[]).includes(value);
}
