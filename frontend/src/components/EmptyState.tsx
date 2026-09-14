import type { ReactNode } from 'react';

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-y border-line bg-surface px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-[48ch] text-ink-2">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  error,
  hint = 'Reload the page. If it keeps happening, check that the API is running.',
}: {
  title?: string;
  error: unknown;
  hint?: string;
}) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="my-4 rounded-control bg-neg-soft px-4 py-3 text-neg">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-[13.5px]">
        {message}. {hint}
      </p>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[3px] bg-neutral-soft ${className}`} />;
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="divide-y divide-line border-y border-line bg-surface"
    >
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-3 py-3.5">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-3.5 ${c === 0 ? 'w-[28%]' : 'w-[14%]'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
