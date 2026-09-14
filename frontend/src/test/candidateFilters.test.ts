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
        { type: 'toggleTier', field: 'schoolTiers', tier: 2 },
      ),
      { type: 'toggleTier', field: 'companyTiers', tier: 1 },
    );
    const params = serializeFilters(state, { contact: 'abc' });
    expect(params.getAll('companies')).toEqual(['Stripe']);
    expect(params.getAll('company_tiers')).toEqual(['1']);
    expect(params.getAll('school_tiers')).toEqual(['2']);
    expect(params.get('contact')).toBe('abc');
    expect(params.has('offset')).toBe(false);
    expect(params.has('skills')).toBe(false);
    expect(parseFilters(params)).toEqual(state);
  });

  it('keeps to the role region by default and only writes the URL when widened', () => {
    expect(parseFilters(new URLSearchParams()).sameRegion).toBe(true);
    expect(serializeFilters(EMPTY_FILTERS).has('all_regions')).toBe(false);
    const wide = filtersReducer(
      { ...EMPTY_FILTERS, offset: 50 },
      { type: 'setSameRegion', on: false },
    );
    expect(wide.offset).toBe(0);
    const params = serializeFilters(wide);
    expect(params.get('all_regions')).toBe('1');
    expect(parseFilters(params).sameRegion).toBe(false);
    // Clearing filters is about filters; the region view stays as the recruiter left it.
    expect(filtersReducer(wide, { type: 'clear' }).sameRegion).toBe(false);
    expect(activeFilterCount(wide)).toBe(0);
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

  it('keeps tiers whole, in range, unique and ascending', () => {
    const parsed = parseFilters(
      new URLSearchParams(
        'company_tiers=9&company_tiers=3&company_tiers=abc&company_tiers=1&company_tiers=3&school_tiers=0&min_score=abc&limit=5000&offset=-3',
      ),
    );
    expect(parsed.companyTiers).toEqual([1, 3]);
    expect(parsed.schoolTiers).toEqual([]);
    expect(parsed.limit).toBe(100);
    expect(parsed.offset).toBe(0);
    expect(parsed).not.toHaveProperty('skills');
    expect(parsed).not.toHaveProperty('companyTier');
    const set = filtersReducer(parsed, {
      type: 'setTiers',
      field: 'schoolTiers',
      tiers: [3, 2, 2],
    });
    expect(set.schoolTiers).toEqual([2, 3]);
  });
});

describe('applied filter chips', () => {
  const state: CandidateFilters = {
    ...EMPTY_FILTERS,
    companies: ['Stripe', 'Figma'],
    schools: ['NYU'],
    companyTiers: [1],
    schoolTiers: [2],
    q: 'priya',
  };

  it('lists one chip per applied value in a stable order and leaves the search text out', () => {
    const chips = appliedFilterChips(state);
    expect(chips.map((c) => c.label)).toEqual([
      'Tier 1 companies',
      'Stripe',
      'Figma',
      'Tier 2 schools',
      'NYU',
    ]);
    expect(chips.map((c) => c.key)).not.toContain('q');
    expect(activeFilterCount(state)).toBe(6);
    expect(appliedFilterChips(EMPTY_FILTERS)).toEqual([]);
  });

  it('each chip removes exactly itself and resets paging', () => {
    const paged = { ...state, offset: 25 };
    const [companyTier, stripe, , schoolTier, nyu] = appliedFilterChips(paged);
    if (!companyTier || !stripe || !schoolTier || !nyu) throw new Error('expected five chips');

    const noStripe = filtersReducer(paged, stripe.remove);
    expect(noStripe.companies).toEqual(['Figma']);
    expect(noStripe.schools).toEqual(['NYU']);
    expect(noStripe.offset).toBe(0);

    expect(filtersReducer(paged, nyu.remove).schools).toEqual([]);
    const noTier = filtersReducer(paged, companyTier.remove);
    expect(noTier.companyTiers).toEqual([]);
    expect(noTier.companies).toEqual(['Stripe', 'Figma']);
    expect(noTier.q).toBe('priya');
    expect(filtersReducer(paged, schoolTier.remove).schoolTiers).toEqual([]);

    // Removing every chip in turn leaves only the search text.
    const bare = appliedFilterChips(paged).reduce((s, c) => filtersReducer(s, c.remove), paged);
    expect(appliedFilterChips(bare)).toEqual([]);
    expect(bare.q).toBe('priya');
  });
});
