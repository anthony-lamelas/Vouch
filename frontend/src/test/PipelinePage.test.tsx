import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApi } from '../api/client';
import type { RequestPage, Stats } from '../api/types';
import { PipelinePage } from '../pages/PipelinePage';

const stats: Stats = {
  employees: 40,
  contacts: 3000,
  connections: 4639,
  roles: 93,
  requests_total: 2,
  requests_active: 1,
  by_status: [
    { status: 'requested', label: 'Waiting on employee', count: 0 },
    { status: 'employee_accepted', label: 'Employee reached out', count: 0 },
    { status: 'employee_declined', label: 'Employee passed', count: 0 },
    { status: 'candidate_interested', label: 'Candidate interested', count: 1 },
    { status: 'candidate_declined', label: 'Candidate passed', count: 0 },
    { status: 'closed', label: 'Closed', count: 1 },
  ],
  slack_enabled: false,
  auth_disabled: true,
};

const contact = {
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
const role = {
  id: 'r1',
  title: 'AI Support Engineer',
  team: 'Support',
  department: 'CE',
  location: 'SF',
  owner_email: null,
  owner_name: null,
};
const employee = {
  id: 'e1',
  full_name: 'Bob Rivera',
  title: 'Senior Infra Engineer',
  team: 'Infra',
  department: 'R&D',
};

const page: RequestPage = {
  total: 2,
  items: [
    {
      id: 'req-old',
      status: 'closed',
      status_label: 'Closed',
      contact: { ...contact, id: 'c2', full_name: 'Kim Morrow' },
      role,
      employee,
      requested_by: 'recruiter@vouch.local',
      requested_by_name: 'Local Recruiter',
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-02T10:00:00Z',
      last_event_at: '2026-09-02T10:00:00Z',
      days_waiting: null,
      stale: false,
      is_mine: true,
      last_message: null,
    },
    {
      id: 'req-new',
      status: 'candidate_interested',
      status_label: 'Candidate interested',
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
    },
  ],
};

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

describe('PipelinePage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    configureApi({ getToken: () => Promise.resolve(null) });
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      const body = url.includes('/api/stats') ? stats : page;
      return Promise.resolve(
        new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }),
      );
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders requests newest first with status pills and the funnel counts', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/pipeline']}>
          <PipelinePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const rows = await screen.findAllByRole('row');
    // header + 2 data rows
    expect(rows).toHaveLength(3);
    const [, first, second] = rows;
    if (!first || !second) throw new Error('expected two data rows');
    expect(within(first).getByText('Terry Glover')).toBeInTheDocument();
    expect(within(first).getByText('Candidate interested')).toBeInTheDocument();
    expect(within(second).getByText('Kim Morrow')).toBeInTheDocument();

    const funnel = screen.getByRole('group', { name: 'Filter by status' });
    const interested = within(funnel).getByRole('button', { name: /Candidate interested/ });
    expect(interested).toHaveTextContent('1');
    expect(within(funnel).getByRole('button', { name: /^All/ })).toHaveTextContent('2');
    const requestUrl = fetchMock.mock.calls
      .map((c) => urlOf(c[0]))
      .find((u) => u.includes('/api/requests'));
    expect(requestUrl).toBe('/api/requests?mine=true&limit=200');
  });
});
