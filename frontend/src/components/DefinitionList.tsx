import type { ReactNode } from 'react';

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 py-1 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-ink break-words">{children}</dd>
    </div>
  );
}
