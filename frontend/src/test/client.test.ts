import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, buildQuery, configureApi } from '../api/client';

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value');
  return value;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    configureApi({ getToken: () => Promise.resolve(null), onUnauthorized: () => undefined });
  });

  it('sends a bearer token when the auth layer provides one', async () => {
    configureApi({ getToken: () => Promise.resolve('tok-123') });
    fetchMock.mockResolvedValue(jsonResponse([]));
    await api.get('/roles', { q: 'infra' });
    const [url, init] = must(fetchMock.mock.calls[0]);
    expect(url).toBe('/api/roles?q=infra');
    const headers = must(init).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-123');
  });

  it('sends no Authorization header in demo mode', async () => {
    configureApi({ getToken: () => Promise.resolve(null) });
    fetchMock.mockResolvedValue(jsonResponse({}));
    await api.get('/stats');
    const init = must(must(fetchMock.mock.calls[0])[1]);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('repeats list params and drops empty ones', () => {
    expect(buildQuery({ companies: ['Stripe', 'Figma'], q: '', min_score: 0.5, x: null })).toBe(
      '?companies=Stripe&companies=Figma&min_score=0.5',
    );
  });

  it('raises ApiError with the FastAPI detail and signals 401s', async () => {
    const onUnauthorized = vi.fn();
    configureApi({ getToken: () => Promise.resolve('expired'), onUnauthorized });
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Invalid or expired session' }, 401));
    const failure = await api.get('/requests').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 401, detail: 'Invalid or expired session' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
