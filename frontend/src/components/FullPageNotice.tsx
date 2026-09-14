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
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <div className="w-full max-w-[360px] text-center">
        <Wordmark size="lg" />
        <p className={`mt-4 text-[16px] font-medium ${muted ? 'text-muted' : 'text-ink'}`}>
          {title}
        </p>
        {children ? <p className="mt-1 text-ink-2">{children}</p> : null}
      </div>
    </div>
  );
}
