import type { Education, Experience } from '../api/types';
import { formatSpan } from '../lib/format';
import { sortEducation, sortExperiences } from '../lib/history';
import { Chip } from './Chip';
import { SectionTitle } from './PageHeader';

/** Experience, Education and Skills, newest first. Shared by the drawer and the request page. */
export function ProfileBlocks({
  experiences,
  education,
  skills,
}: {
  experiences: Experience[];
  education: Education[];
  skills: string[];
}) {
  return (
    <>
      <section>
        <SectionTitle>Experience</SectionTitle>
        <ol className="ml-[3px] space-y-2 border-l border-line pl-3.5 text-[13px]">
          {sortExperiences(experiences).map((e, i) => (
            <li key={i} className="relative">
              <span
                aria-hidden
                className={`absolute -left-[17.5px] top-[6px] size-[7px] rounded-full ring-2 ring-canvas ${
                  e.end ? 'bg-line' : 'bg-cobalt'
                }`}
              />
              <div className="leading-5 text-ink">
                <span className="font-medium">{e.title ?? '—'}</span>
                <span className="text-carbon"> at {e.company ?? '—'}</span>
              </div>
              <div className="text-[12px] tracking-normal text-muted tnum">
                {e.team ? `${e.team}, ` : ''}
                {formatSpan(e.start, e.end)}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {education.length > 0 ? (
        <section>
          <SectionTitle>Education</SectionTitle>
          <ul className="space-y-1 text-[13px]">
            {sortEducation(education).map((ed, i) => (
              <li key={i}>
                <div className="text-ink">{ed.school ?? '—'}</div>
                <div className="text-[12px] tracking-normal text-muted tnum">
                  {[ed.degree, ed.field].filter(Boolean).join(', ')}
                  {ed.start_year || ed.end_year
                    ? `, ${String(ed.start_year ?? '?')}–${String(ed.end_year ?? '?')}`
                    : ''}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionTitle>Skills</SectionTitle>
        <div className="flex flex-wrap gap-1">
          {skills.map((s) => (
            <Chip key={s}>{s}</Chip>
          ))}
        </div>
      </section>
    </>
  );
}
