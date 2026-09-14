import { describe, expect, it } from 'vitest';
import { sortEducation, sortExperiences } from '../lib/history';

describe('history ordering', () => {
  it('puts the current role first, then earlier roles by start date descending', () => {
    const list = [
      { company: 'Old Co', title: 'Intern', start: '2015-06-01', end: '2016-01-01' },
      { company: 'Stripe', title: 'Staff', start: '2021-03-01', end: null },
      { company: 'Mid Co', title: 'Engineer', start: '2018-09-01', end: '2021-02-01' },
      { company: 'Unknown', title: 'Advisor', start: null, end: '2017-01-01' },
    ];
    expect(sortExperiences(list).map((e) => e.company)).toEqual([
      'Stripe',
      'Mid Co',
      'Old Co',
      'Unknown',
    ]);
    expect(list[0]?.company).toBe('Old Co');
  });

  it('orders education newest first by start year, using end year when start is missing', () => {
    const list = [
      { school: 'MIT', start_year: 2010, end_year: 2014 },
      { school: 'NYU', start_year: null, end_year: 2019 },
      { school: 'Stanford', start_year: 2016, end_year: 2018 },
      { school: 'Nowhere', start_year: null, end_year: null },
    ];
    expect(sortEducation(list).map((e) => e.school)).toEqual(['NYU', 'Stanford', 'MIT', 'Nowhere']);
  });
});
