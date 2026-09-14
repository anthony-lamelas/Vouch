import type { RequestSummary, Status } from '../api/types';

export const contact = {
  id: 'c1',
  full_name: 'Terry Glover',
  headline: 'Forward Deployed Engineer at DoorDash',
  location: 'San Francisco',
  current_company: 'DoorDash',
  current_title: 'Forward Deployed Engineer',
  job_family: 'customer_engineering',
  seniority: 'mid',
  skills: ['AWS'],
};

export const role = {
  id: 'r1',
  title: 'AI Support Engineer',
  team: 'Support',
  department: 'CE',
  location: 'SF',
  owner_email: null,
  owner_name: null,
  job_url: 'https://jobs.ashbyhq.com/cognition/abc',
};

export const employee = {
  id: 'e1',
  full_name: 'Bob Rivera',
  title: 'Senior Infra Engineer',
  team: 'Infra',
  department: 'R&D',
};

let seq = 0;

export function makeRequest(
  status: Status,
  overrides: Partial<RequestSummary> = {},
): RequestSummary {
  seq += 1;
  return {
    id: `req-${seq}`,
    status,
    status_label: status,
    contact,
    role,
    employee,
    requested_by: 'recruiter@vouch.local',
    requested_by_name: 'Local Recruiter',
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-11T10:00:00Z',
    last_event_at: '2026-09-11T10:00:00Z',
    days_waiting: null,
    stale: false,
    is_mine: true,
    last_message: null,
    ...overrides,
  };
}
