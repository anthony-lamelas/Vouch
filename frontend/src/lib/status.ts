import type { Status } from '../api/types';

export type Tone = 'neutral' | 'positive' | 'warning' | 'negative';

export const STATUS_ORDER: readonly Status[] = [
  'requested',
  'employee_accepted',
  'employee_declined',
  'contacted',
  'candidate_interested',
  'candidate_declined',
  'no_response',
  'closed',
];

export const STATUS_LABELS: Record<Status, string> = {
  requested: 'Requested',
  employee_accepted: 'Employee accepted',
  employee_declined: 'Employee declined',
  contacted: 'Contacted',
  candidate_interested: 'Candidate interested',
  candidate_declined: 'Candidate declined',
  no_response: 'No response',
  closed: 'Closed',
};

export const STATUS_TONES: Record<Status, Tone> = {
  requested: 'neutral',
  employee_accepted: 'positive',
  employee_declined: 'negative',
  contacted: 'positive',
  candidate_interested: 'positive',
  candidate_declined: 'negative',
  no_response: 'warning',
  closed: 'neutral',
};

export function isStatus(value: string): value is Status {
  return (STATUS_ORDER as readonly string[]).includes(value);
}

export const DECLINE_REASON_LABELS = {
  dont_know_well: "Doesn't know them well",
  not_a_fit: 'Not a fit',
} as const;
