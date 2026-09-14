/**
 * Candidate filter state lives in the URL so links are shareable. This module is the single
 * place that knows how to read it, write it, change it, and describe it as removable chips.
 */

export interface CandidateFilters {
  companies: string[];
  schools: string[];
  skills: string[];
  companyTier: number | null;
  q: string;
  limit: number;
  offset: number;
}

export type ListField = 'companies' | 'schools' | 'skills';

export const DEFAULT_LIMIT = 25;

export const EMPTY_FILTERS: CandidateFilters = {
  companies: [],
  schools: [],
  skills: [],
  companyTier: null,
  q: '',
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
  if (filters.limit !== DEFAULT_LIMIT) params.set('limit', String(filters.limit));
  if (filters.offset > 0) params.set('offset', String(filters.offset));
  if (extra) {
    for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  }
  return params;
}

export type FilterAction =
  | { type: 'setQuery'; q: string }
  | { type: 'toggle'; field: ListField; value: string }
  | { type: 'setList'; field: ListField; values: string[] }
  | { type: 'setTier'; tier: number | null }
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
    case 'setPage':
      return { ...state, offset: Math.max(0, action.offset) };
    case 'clear':
      return { ...EMPTY_FILTERS, limit: state.limit };
  }
}

export interface AppliedFilterChip {
  key: string;
  label: string;
  /** Dispatching this removes exactly this chip and nothing else. */
  remove: FilterAction;
}

/**
 * The applied filters as removable chips, in a stable order: companies, schools, skills, tier.
 * The search text is not a chip; it lives in the search box.
 */
export function appliedFilterChips(f: CandidateFilters): AppliedFilterChip[] {
  const chips: AppliedFilterChip[] = [];
  const lists: ListField[] = ['companies', 'schools', 'skills'];
  for (const field of lists) {
    for (const value of f[field]) {
      chips.push({
        key: `${field}:${value}`,
        label: value,
        remove: { type: 'toggle', field, value },
      });
    }
  }
  if (f.companyTier !== null) {
    chips.push({
      key: 'tier',
      label: `Tier ${f.companyTier}`,
      remove: { type: 'setTier', tier: null },
    });
  }
  return chips;
}

export function activeFilterCount(f: CandidateFilters): number {
  return appliedFilterChips(f).length + (f.q ? 1 : 0);
}
