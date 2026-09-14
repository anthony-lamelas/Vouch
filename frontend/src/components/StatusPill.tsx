import type { ReactNode } from 'react';
import type { Status } from '../api/types';
import { TONE_CLASS } from '../lib/classes';
import { STATUS_LABELS, STATUS_TONES, type Tone } from '../lib/status';

/** Attio-style soft tag: filled background, tinted text, 7px radius. */
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
  return (
    <span
      {...rest}
      className={`inline-flex h-[22px] items-center whitespace-nowrap rounded-tag px-2 text-[12px] font-medium tracking-normal ${TONE_CLASS[tone]} ${className}`}
    >
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
