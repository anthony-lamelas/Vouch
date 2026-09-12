/**
 * Thin fetch wrapper. The API lives at the same origin under /api in production and is
 * proxied there by Vite in development, so the base is always relative.
 */

export const API_BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

interface ApiHooks {
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
}

let hooks: ApiHooks = {
  getToken: () => Promise.resolve(null),
  onUnauthorized: () => undefined,
};

/** Wire the auth layer into the client. Called once by AuthProvider. */
export function configureApi(next: Partial<ApiHooks>): void {
  hooks = { ...hooks, ...next };
}

export function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (v === undefined || v === null || v === '') continue;
      search.append(key, String(v));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

async function parseDetail(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return res.statusText || `HTTP ${res.status}`;
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail: unknown = body.detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        // FastAPI validation errors
        return detail
          .map((d: unknown) => {
            if (d && typeof d === 'object' && 'msg' in d && typeof d.msg === 'string') return d.msg;
            return '';
          })
          .filter(Boolean)
          .join('; ');
      }
      return JSON.stringify(detail);
    }
  } catch {
    // not JSON
  }
  return text;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: QueryParams;
  body?: unknown;
  /** Skip the Authorization header (e.g. /config). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!options.anonymous) {
    const token = await hooks.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}${buildQuery(options.params)}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  if (res.status === 401 && !options.anonymous) {
    hooks.onUnauthorized();
  }
  if (!res.ok) {
    throw new ApiError(res.status, await parseDetail(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    request<T>(path, { params, signal }),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
};
