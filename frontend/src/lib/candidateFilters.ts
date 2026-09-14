/**
 * Candidate filter state lives in the URL so links are shareable. This module is the single
 * place that knows how to read it, write it, change it, and describe it as removable chips.
 */

export interface CandidateFilters {
  companies: string[];
  schools: string[];
  /** Company tiers 1–3, sent as repeatable `company_tiers`. */
  companyTiers: number[];
  /** School tiers 1–3, sent as repeatable `school_tiers`. */
  schoolTiers: number[];
  /** Only people in the role's region. On by default; the URL carries `all_regions=1` when off. */
  sameRegion: boolean;
  q: string;
  limit: number;
  offset: number;
}

export type ListField = 'companies' | 'schools';
export type TierField = 'companyTiers' | 'schoolTiers';

export const TIERS: readonly number[] = [1, 2, 3];

export const DEFAULT_LIMIT = 25;

export const EMPTY_FILTERS: CandidateFilters = {
  companies: [],
  schools: [],
  companyTiers: [],
  schoolTiers: [],
  sameRegion: true,
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

/** Keeps only whole tiers 1–3, de-duplicated and ascending. */
function tiers(values: string[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    const n = Number(v);
    if (Number.isInteger(n) && TIERS.includes(n) && !out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

export function parseFilters(params: URLSearchParams): CandidateFilters {
  return {
    companies: params.getAll('companies').filter(Boolean),
    schools: params.getAll('schools').filter(Boolean),
    companyTiers: tiers(params.getAll('company_tiers')),
    schoolTiers: tiers(params.getAll('school_tiers')),
    sameRegion: params.get('all_regions') !== '1',
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
  for (const t of filters.companyTiers) params.append('company_tiers', String(t));
  for (const t of filters.schoolTiers) params.append('school_tiers', String(t));
  if (!filters.sameRegion) params.set('all_regions', '1');
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
  | { type: 'toggleTier'; field: TierField; tier: number }
  | { type: 'setTiers'; field: TierField; tiers: number[] }
  | { type: 'setSameRegion'; on: boolean }
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
    case 'toggleTier': {
      const current = state[action.field];
      const next = current.includes(action.tier)
        ? current.filter((t) => t !== action.tier)
        : [...current, action.tier].sort((a, b) => a - b);
      return { ...state, [action.field]: next, offset: 0 };
    }
    case 'setTiers':
      return { ...state, [action.field]: tiers(action.tiers.map(String)), offset: 0 };
    case 'setSameRegion':
      return { ...state, sameRegion: action.on, offset: 0 };
    case 'setPage':
      return { ...state, offset: Math.max(0, action.offset) };
    case 'clear':
      // The region toggle is a view preference, not a filter: clearing leaves it alone.
      return { ...EMPTY_FILTERS, limit: state.limit, sameRegion: state.sameRegion };
  }
}

export interface AppliedFilterChip {
  key: string;
  label: string;
  /** Dispatching this removes exactly this chip and nothing else. */
  remove: FilterAction;
}

/**
 * The applied filters as removable chips, in a stable order: company tiers, companies, school
 * tiers, schools. The search text is not a chip; it lives in the search box.
 */
export function appliedFilterChips(f: CandidateFilters): AppliedFilterChip[] {
  const chips: AppliedFilterChip[] = [];
  const push = (tierField: TierField, listField: ListField, noun: string) => {
    for (const tier of f[tierField]) {
      chips.push({
        key: `${tierField}:${tier}`,
        label: `Tier ${tier} ${noun}`,
        remove: { type: 'toggleTier', field: tierField, tier },
      });
    }
    for (const value of f[listField]) {
      chips.push({
        key: `${listField}:${value}`,
        label: value,
        remove: { type: 'toggle', field: listField, value },
      });
    }
  };
  push('companyTiers', 'companies', 'companies');
  push('schoolTiers', 'schools', 'schools');
  return chips;
}

export function activeFilterCount(f: CandidateFilters): number {
  return appliedFilterChips(f).length + (f.q ? 1 : 0);
}
