/**
 * Candidate filter state lives in the URL so links are shareable. This module is the single
 * place that knows how to read it, write it, and change it.
 */

export interface CandidateFilters {
  companies: string[];
  schools: string[];
  skills: string[];
  companyTier: number | null;
  q: string;
  minScore: number;
  limit: number;
  offset: number;
}

export const DEFAULT_LIMIT = 25;

export const EMPTY_FILTERS: CandidateFilters = {
  companies: [],
  schools: [],
  skills: [],
  companyTier: null,
  q: '',
  minScore: 0,
  limit: DEFAULT_LIMIT,
  offset: 0,
};

function num(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function parseFilters(params: URLSearchParams): CandidateFilters {
  const tier = params.get('company_tier');
  const tierNum = tier ? Number(tier) : NaN;
  return {
    companies: params.getAll('companies').filter(Boolean),
    schools: params.getAll('schools').filter(Boolean),
    skills: params.getAll('skills').filter(Boolean),
    companyTier: Number.isInteger(tierNum) && tierNum >= 1 && tierNum <= 3 ? tierNum : null,
    q: params.get('q') ?? '',
    minScore: num(params.get('min_score'), 0, 0, 1),
    limit: Math.round(num(params.get('limit'), DEFAULT_LIMIT, 1, 100)),
    offset: Math.round(num(params.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)),
  };
}

/** Writes only non-default values so URLs stay short. `extra` preserves unrelated params. */
export function serializeFilters(
  filters: CandidateFilters,
  extra?: Record<string, string | null | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const c of filters.companies) params.append('companies', c);
  for (const s of filters.schools) params.append('schools', s);
  for (const s of filters.skills) params.append('skills', s);
  if (filters.companyTier !== null) params.set('company_tier', String(filters.companyTier));
  if (filters.q) params.set('q', filters.q);
  if (filters.minScore > 0) params.set('min_score', String(filters.minScore));
  if (filters.limit !== DEFAULT_LIMIT) params.set('limit', String(filters.limit));
  if (filters.offset > 0) params.set('offset', String(filters.offset));
  if (extra) {
    for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  }
  return params;
}

export type FilterAction =
  | { type: 'setQuery'; q: string }
  | { type: 'toggle'; field: 'companies' | 'schools' | 'skills'; value: string }
  | { type: 'setList'; field: 'companies' | 'schools' | 'skills'; values: string[] }
  | { type: 'setTier'; tier: number | null }
  | { type: 'setMinScore'; minScore: number }
  | { type: 'setPage'; offset: number }
  | { type: 'clear' };

/** Any change other than paging resets to the first page. */
export function filtersReducer(state: CandidateFilters, action: FilterAction): CandidateFilters {
  switch (action.type) {
    case 'setQuery':
      return { ...state, q: action.q, offset: 0 };
    case 'toggle': {
      const current = state[action.field];
      const next = current.includes(action.value)
        ? current.filter((v) => v !== action.value)
        : [...current, action.value];
      return { ...state, [action.field]: next, offset: 0 };
    }
    case 'setList':
      return { ...state, [action.field]: action.values, offset: 0 };
    case 'setTier':
      return { ...state, companyTier: action.tier, offset: 0 };
    case 'setMinScore':
      return { ...state, minScore: action.minScore, offset: 0 };
    case 'setPage':
      return { ...state, offset: Math.max(0, action.offset) };
    case 'clear':
      return { ...EMPTY_FILTERS, limit: state.limit };
  }
}

export function activeFilterCount(f: CandidateFilters): number {
  return (
    f.companies.length +
    f.schools.length +
    f.skills.length +
    (f.companyTier !== null ? 1 : 0) +
    (f.q ? 1 : 0) +
    (f.minScore > 0 ? 1 : 0)
  );
}
