import type { Education, Experience } from '../api/types';

/** Newest first: current role (no end) on top, then by start date descending. */
export function sortExperiences(list: Experience[]): Experience[] {
  const startOf = (e: Experience) => (e.start ? new Date(e.start).getTime() : Number.NaN);
  return [...list].sort((a, b) => {
    const aCurrent = !a.end;
    const bCurrent = !b.end;
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
    return (
      (Number.isNaN(startOf(b)) ? 0 : startOf(b)) - (Number.isNaN(startOf(a)) ? 0 : startOf(a))
    );
  });
}

/** Newest first by start year, falling back to end year; unknown years sink to the bottom. */
export function sortEducation(list: Education[]): Education[] {
  const yearOf = (e: Education) => e.start_year ?? e.end_year ?? 0;
  return [...list].sort((a, b) => yearOf(b) - yearOf(a));
}
