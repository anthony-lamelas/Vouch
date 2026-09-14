import type { ReactNode } from 'react';

/** One quiet line, with any action inline as a link. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-line py-6 text-center text-[13px] text-muted">{children}</div>
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
    <div role="alert" className="my-4 rounded-card bg-no-bg px-4 py-3 text-[13px] text-no-text">
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5">
        {message}. {hint}
      </p>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[4px] bg-haze ${className}`} />;
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="divide-y divide-line border-b border-line"
    >
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-9 items-center gap-4 px-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-3 ${c === 0 ? 'w-[28%]' : 'w-[14%]'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
