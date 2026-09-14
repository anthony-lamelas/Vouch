import type { ReactNode } from 'react';
import { Wordmark } from './Wordmark';

export function FullPageNotice({
  title,
  children,
  muted = false,
}: {
  title: string;
  children?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="w-full max-w-[360px] rounded-card border border-line bg-canvas p-6 text-center shadow-card">
        <Wordmark size="lg" />
        <p className={`mt-3 text-[14px] font-medium ${muted ? 'text-muted' : 'text-ink'}`}>
          {title}
        </p>
        {children ? <p className="mt-1 text-[13px] text-muted">{children}</p> : null}
      </div>
    </div>
  );
}
