import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  filtersReducer,
  parseFilters,
  serializeFilters,
} from '../lib/candidateFilters';

describe('candidate filter state', () => {
  it('round-trips through URL search params using the API parameter names', () => {
    const state = filtersReducer(
      filtersReducer(
        filtersReducer(EMPTY_FILTERS, { type: 'toggle', field: 'companies', value: 'Stripe' }),
        { type: 'toggle', field: 'skills', value: 'Kubernetes' },
      ),
      { type: 'setTier', tier: 1 },
    );
    const params = serializeFilters(state, { contact: 'abc' });
    expect(params.getAll('companies')).toEqual(['Stripe']);
    expect(params.getAll('skills')).toEqual(['Kubernetes']);
    expect(params.get('company_tier')).toBe('1');
    expect(params.get('contact')).toBe('abc');
    expect(params.has('offset')).toBe(false);
    expect(parseFilters(params)).toEqual(state);
  });

  it('resets paging when a filter changes, but not when paging', () => {
    const paged = filtersReducer(EMPTY_FILTERS, { type: 'setPage', offset: 50 });
    expect(paged.offset).toBe(50);
    const searched = filtersReducer(paged, { type: 'setQuery', q: 'bob' });
    expect(searched.offset).toBe(0);
    expect(searched.q).toBe('bob');
  });

  it('toggling an applied value removes it and clear resets everything', () => {
    const on = filtersReducer(EMPTY_FILTERS, { type: 'toggle', field: 'schools', value: 'MIT' });
    const off = filtersReducer(on, { type: 'toggle', field: 'schools', value: 'MIT' });
    expect(off.schools).toEqual([]);
    expect(activeFilterCount(on)).toBe(1);
    expect(filtersReducer(on, { type: 'clear' })).toEqual(EMPTY_FILTERS);
  });

  it('ignores malformed values from hand-edited URLs', () => {
    const parsed = parseFilters(
      new URLSearchParams('company_tier=9&min_score=abc&limit=5000&offset=-3'),
    );
    expect(parsed.companyTier).toBeNull();
    expect(parsed.minScore).toBe(0);
    expect(parsed.limit).toBe(100);
    expect(parsed.offset).toBe(0);
  });
});
