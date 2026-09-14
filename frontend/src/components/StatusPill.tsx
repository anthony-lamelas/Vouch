import type { ReactNode } from 'react';
import type { Status } from '../api/types';
import { STATUS_LABELS, STATUS_TONES, type Tone } from '../lib/status';

const TONE_CLASS: Record<Tone, { tag: string; dot: string }> = {
  neutral: { tag: 'bg-closed-bg text-closed-text', dot: 'bg-closed-dot' },
  warning: { tag: 'bg-wait-bg text-wait-text', dot: 'bg-wait-dot' },
  info: { tag: 'bg-reach-bg text-reach-text', dot: 'bg-reach-dot' },
  positive: { tag: 'bg-yes-bg text-yes-text', dot: 'bg-yes-dot' },
  negative: { tag: 'bg-no-bg text-no-text', dot: 'bg-no-dot' },
};

/** Attio-style soft tag: filled background, 6px dot, 7px radius. */
export function Tag({
  tone,
  children,
  className = '',
  ...rest
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
  'data-status'?: string;
  'data-tone'?: string;
}) {
  const cls = TONE_CLASS[tone];
  return (
    <span
      {...rest}
      className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-tag px-2 text-[12px] font-medium tracking-normal ${cls.tag} ${className}`}
    >
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${cls.dot}`} />
      {children}
    </span>
  );
}

export function StatusPill({ status, className = '' }: { status: Status; className?: string }) {
  const tone = STATUS_TONES[status];
  return (
    <Tag tone={tone} data-status={status} data-tone={tone} className={className}>
      {STATUS_LABELS[status]}
    </Tag>
  );
}
