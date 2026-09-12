import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  children,
  crumbs,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  crumbs?: ReactNode;
}) {
  return (
    <div className="mb-4">
      {crumbs ? <div className="text-[12px] text-muted mb-1.5">{crumbs}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">{title}</h1>
          {subtitle ? <div className="mt-1 text-muted">{subtitle}</div> : null}
        </div>
        {children ? <div className="flex items-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-2">
      <h2 className="text-[13px] font-semibold text-ink font-sans">{children}</h2>
      {aside ? <div className="text-[12px] text-muted">{aside}</div> : null}
    </div>
  );
}
