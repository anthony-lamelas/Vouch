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
    <div className="min-h-screen grid place-items-center bg-ground">
      <div className="w-[360px] text-center">
        <Wordmark size="lg" />
        <p className={`mt-4 text-[15px] font-medium ${muted ? 'text-muted' : 'text-ink'}`}>
          {title}
        </p>
        {children ? <p className="mt-1 text-muted">{children}</p> : null}
      </div>
    </div>
  );
}
