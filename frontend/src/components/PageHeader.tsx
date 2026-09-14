import type { ReactNode } from 'react';

/** Page title in the serif voice; everything around it stays quiet. */
export function PageHeader({
  title,
  meta,
  children,
  below,
}: {
  title: ReactNode;
  meta?: ReactNode;
  /** Controls, right-aligned on the title row. */
  children?: ReactNode;
  /** Anything that belongs under the title but before the body, e.g. skill chips. */
  below?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] font-medium leading-[1.15] tracking-[-0.01em] text-ink">
            {title}
          </h1>
          {meta ? <div className="mt-1.5 text-[14px] text-ink-2">{meta}</div> : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
      {below ? <div className="mt-3">{below}</div> : null}
    </div>
  );
}

export function SectionTitle({
  children,
  count,
  aside,
  className = '',
}: {
  children: ReactNode;
  count?: number;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-2 flex items-baseline justify-between gap-4 ${className}`}>
      <h2 className="text-[14px] font-semibold text-ink">
        {children}
        {count !== undefined ? (
          <span className="ml-1.5 font-normal text-muted tnum">{count}</span>
        ) : null}
      </h2>
      {aside ? <div className="text-[13px] text-muted">{aside}</div> : null}
    </div>
  );
}
