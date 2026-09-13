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
    <div className="py-14 text-center">
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {children ? <p className="mt-1 text-muted max-w-[46ch] mx-auto">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  error,
}: {
  title?: string;
  error: unknown;
}) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="my-4 rounded border border-neg/30 bg-neg-soft px-4 py-3 text-neg">
      <p className="font-medium">{title}</p>
      <p className="text-[12.5px] mt-0.5">{message}</p>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-raised ${className}`} />;
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-3 py-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-3.5 ${c === 0 ? 'w-[28%]' : 'w-[14%]'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
