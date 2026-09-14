import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  appliedFilterChips,
  filtersReducer,
  parseFilters,
  serializeFilters,
  type CandidateFilters,
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
    expect(parsed.limit).toBe(100);
    expect(parsed.offset).toBe(0);
    expect(parsed).not.toHaveProperty('minScore');
  });
});

describe('applied filter chips', () => {
  const state: CandidateFilters = {
    ...EMPTY_FILTERS,
    companies: ['Stripe', 'Figma'],
    schools: ['MIT'],
    skills: ['Kubernetes'],
    companyTier: 1,
    q: 'priya',
  };

  it('lists one chip per applied value in a stable order and leaves the search text out', () => {
    const chips = appliedFilterChips(state);
    expect(chips.map((c) => c.label)).toEqual(['Stripe', 'Figma', 'MIT', 'Kubernetes', 'Tier 1']);
    expect(chips.map((c) => c.key)).not.toContain('q');
    expect(activeFilterCount(state)).toBe(6);
    expect(appliedFilterChips(EMPTY_FILTERS)).toEqual([]);
  });

  it('each chip removes exactly itself and resets paging', () => {
    const paged = { ...state, offset: 25 };
    const [stripe, , mit, k8s, tier] = appliedFilterChips(paged);
    if (!stripe || !mit || !k8s || !tier) throw new Error('expected five chips');

    const noStripe = filtersReducer(paged, stripe.remove);
    expect(noStripe.companies).toEqual(['Figma']);
    expect(noStripe.schools).toEqual(['MIT']);
    expect(noStripe.offset).toBe(0);

    expect(filtersReducer(paged, mit.remove).schools).toEqual([]);
    expect(filtersReducer(paged, k8s.remove).skills).toEqual([]);
    const noTier = filtersReducer(paged, tier.remove);
    expect(noTier.companyTier).toBeNull();
    expect(noTier.companies).toEqual(['Stripe', 'Figma']);
    expect(noTier.q).toBe('priya');

    // Removing every chip in turn leaves only the search text.
    const bare = appliedFilterChips(paged).reduce((s, c) => filtersReducer(s, c.remove), paged);
    expect(appliedFilterChips(bare)).toEqual([]);
    expect(bare.q).toBe('priya');
  });
});
