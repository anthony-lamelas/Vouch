import type { Status } from '../api/types';
import { STATUS_LABELS, STATUS_TONES, type Tone } from '../lib/status';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-ink-2',
  positive: 'bg-pos-soft text-pos',
  warning: 'bg-ochre-soft text-ochre',
  negative: 'bg-neg-soft text-neg',
};

export function StatusPill({ status, className = '' }: { status: Status; className?: string }) {
  const tone = STATUS_TONES[status];
  return (
    <span
      data-status={status}
      data-tone={tone}
      className={`inline-flex items-center whitespace-nowrap rounded-control px-1.5 text-[12.5px] font-medium leading-[18px] ${TONE_CLASS[tone]} ${className}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
