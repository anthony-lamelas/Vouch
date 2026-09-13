import type { Status } from '../api/types';
import { STATUS_LABELS, STATUS_TONES, type Tone } from '../lib/status';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-raised text-ink-2 border-line-2',
  positive: 'bg-pos-soft text-pos border-pos/30',
  warning: 'bg-warn-soft text-warn border-warn/30',
  negative: 'bg-neg-soft text-neg border-neg/30',
};

const DOT_CLASS: Record<Tone, string> = {
  neutral: 'bg-faint',
  positive: 'bg-pos',
  warning: 'bg-warn',
  negative: 'bg-neg',
};

export function StatusPill({
  status,
  size = 'md',
  className = '',
}: {
  status: Status;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const tone = STATUS_TONES[status];
  const pad = size === 'sm' ? 'px-1.5 py-px text-[11px]' : 'px-2 py-0.5 text-[12px]';
  return (
    <span
      data-status={status}
      data-tone={tone}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium ${pad} ${TONE_CLASS[tone]} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
