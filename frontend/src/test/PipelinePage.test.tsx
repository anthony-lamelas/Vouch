import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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

  it('groups requests into sections, silence first, and asks for my requests by default', async () => {
    renderAt('/pipeline');
    const needsYou = await screen.findByRole('rowgroup', { name: /Needs you/ });
    const names = within(needsYou)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');
    expect(names[0]).toContain('Jill James');
    expect(names[1]).toContain('Terry Glover');
    expect(within(needsYou).getByText('No reply · 10d')).toBeInTheDocument();
    expect(within(needsYou).getByRole('img', { name: 'Delivered' })).toBeInTheDocument();

    const closed = screen.getByRole('rowgroup', { name: /Closed/ });
    expect(within(closed).getByText('Kim Morrow')).toBeInTheDocument();
    expect(screen.queryByRole('rowgroup', { name: /Waiting on employee/ })).toBeNull();

    const requestUrl = fetchMock.mock.calls
      .map((c) => urlOf(c[0]))
      .find((u) => u.includes('/api/requests'));
    expect(requestUrl).toBe('/api/requests?mine=true&limit=200');
  });

  it('shows a removable chip for a deep-linked status filter and hides closed when asked', async () => {
    renderAt('/pipeline?scope=mine&status=candidate_interested&active_only=1');
    await screen.findByRole('rowgroup', { name: /Needs you/ });
    expect(screen.getByRole('button', { name: 'Remove Candidate interested' })).toBeInTheDocument();
    expect(screen.queryByRole('rowgroup', { name: /Closed/ })).toBeNull();
    const requestUrl = fetchMock.mock.calls
      .map((c) => urlOf(c[0]))
      .find((u) => u.includes('/api/requests'));
    expect(requestUrl).toBe(
      '/api/requests?status=candidate_interested&active_only=true&mine=true&limit=200',
    );
  });
});
