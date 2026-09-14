import type { ReactNode } from 'react';

/** 52px header row: title left, tab bar beside it, actions right, 1px rule underneath. */
export function PageHeader({
  title,
  tabs,
  children,
}: {
  title: ReactNode;
  tabs?: ReactNode;
  /** Controls, right-aligned on the title row. */
  children?: ReactNode;
}) {
  return (
    <div className="flex h-[52px] items-stretch gap-5 border-b border-line">
      <h1 className="flex min-w-0 items-center text-[20px] font-semibold leading-[1.35] tracking-[-0.01em] text-ink">
        {title}
      </h1>
      {tabs ? <div className="flex items-stretch">{tabs}</div> : null}
      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
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
    <div className={`mb-1.5 flex items-baseline justify-between gap-4 ${className}`}>
      <h2 className="text-[13px] font-semibold text-ink">
        {children}
        {count !== undefined ? <span className="ml-1.5 text-muted tnum">{count}</span> : null}
      </h2>
      {aside ? <div className="text-[12px] text-muted">{aside}</div> : null}
    </div>
  );
}
