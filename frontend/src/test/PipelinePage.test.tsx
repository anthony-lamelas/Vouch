import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApi } from '../api/client';
import type { RequestPage } from '../api/types';
import { PipelinePage } from '../pages/PipelinePage';
import { contact, makeRequest } from './fixtures';

const page: RequestPage = {
  total: 3,
  items: [
    makeRequest('closed', {
      id: 'req-old',
      contact: { ...contact, id: 'c2', full_name: 'Kim Morrow' },
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-02T10:00:00Z',
      last_event_at: '2026-09-02T10:00:00Z',
    }),
    makeRequest('candidate_interested', { id: 'req-new', contact }),
    makeRequest('employee_accepted', {
      id: 'req-stale',
      contact: { ...contact, id: 'c3', full_name: 'Jill James' },
      stale: true,
      days_waiting: 10,
      last_event_at: '2026-09-03T10:00:00Z',
      last_message: {
        excerpt: 'Hey Jill! Feels like ages since Stripe',
        delivered: true,
        error: null,
        created_at: '2026-09-03T10:00:00Z',
        employee_name: 'Bob Rivera',
      },
    }),
  ],
};

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <PipelinePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function firstCells() {
  return within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');
}

describe('PipelinePage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    configureApi({ getToken: () => Promise.resolve(null) });
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(page), { headers: { 'Content-Type': 'application/json' } }),
      ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists every request flat, newest activity first, and asks for my requests by default', async () => {
    renderAt('/pipeline');
    await screen.findByRole('table');
    // No stage grouping any more: a single body, no labelled row groups.
    expect(screen.queryByRole('rowgroup', { name: /Needs you/ })).toBeNull();
    const names = firstCells();
    expect(names[0]).toContain('Terry Glover');
    expect(names[1]).toContain('Jill James');
    expect(names[2]).toContain('Kim Morrow');
    expect(screen.getByText('No reply · 10d')).toBeInTheDocument();
    expect(screen.getByText('Jill James').closest('tr')).toHaveClass('is-stale');
    expect(screen.queryByText(/Feels like ages since Stripe/)).toBeNull();
    expect(screen.getByText('3 requests')).toBeInTheDocument();

    const requestUrl = fetchMock.mock.calls
      .map((c) => urlOf(c[0]))
      .find((u) => u.includes('/api/requests'));
    expect(requestUrl).toBe('/api/requests?mine=true&limit=200');
  });

  it('sorts by a column header, flips on the second click, and reads sort from the URL', async () => {
    const user = userEvent.setup();
    renderAt('/pipeline');
    await screen.findByRole('table');
    const activity = screen.getByRole('columnheader', { name: /Last activity/ });
    expect(activity).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getAllByTestId('sort-chevron')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Candidate' }));
    expect(firstCells().map((s) => s.slice(0, 3))).toEqual(['Jil', 'Kim', 'Ter']);
    expect(screen.getByRole('columnheader', { name: /Candidate/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(activity).not.toHaveAttribute('aria-sort');

    await user.click(screen.getByRole('button', { name: 'Candidate' }));
    expect(firstCells().map((s) => s.slice(0, 3))).toEqual(['Ter', 'Kim', 'Jil']);
    expect(screen.getByRole('columnheader', { name: /Candidate/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    // Clearing filters keeps the chosen sort.
    await user.click(screen.getByRole('button', { name: 'Add status filter' }));
    await user.click(within(screen.getByRole('option', { name: 'Closed' })).getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Remove Closed' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByRole('button', { name: 'Remove Closed' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: /Candidate/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('honours a sort deep link', async () => {
    renderAt('/pipeline?sort=status&dir=asc');
    await screen.findByRole('table');
    // "Candidate interested" < "Closed" < "Employee reached out".
    expect(firstCells().map((s) => s.slice(0, 3))).toEqual(['Ter', 'Kim', 'Jil']);
    expect(screen.getByRole('columnheader', { name: /Status/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('narrows by search text without touching the URL', async () => {
    const user = userEvent.setup();
    renderAt('/pipeline');
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search requests' }), 'kim');
    expect(firstCells()).toHaveLength(1);
    expect(firstCells()[0]).toContain('Kim Morrow');
    expect(screen.getByText('1 request')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter((c) => urlOf(c[0]).includes('/api/requests'))).toHaveLength(
      1,
    );
  });

  it('offers the six statuses in the Status picker and mirrors a deep link as a chip', async () => {
    const user = userEvent.setup();
    renderAt('/pipeline?scope=mine&status=candidate_interested&active_only=1');
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Remove Candidate interested' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
    const requestUrl = fetchMock.mock.calls
      .map((c) => urlOf(c[0]))
      .find((u) => u.includes('/api/requests'));
    expect(requestUrl).toBe(
      '/api/requests?status=candidate_interested&active_only=true&mine=true&limit=200',
    );

    await user.click(screen.getByRole('button', { name: 'Add status filter' }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual([
      'Waiting on employee',
      'Employee reached out',
      'Employee passed',
      'Candidate interested',
      'Candidate passed',
      'Closed',
    ]);
    expect(screen.getByRole('option', { name: 'Candidate interested' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
