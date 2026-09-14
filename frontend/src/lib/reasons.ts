import type { Reason } from '../api/types';

/** "7 of 8 required skills: GPUs, PyTorch" becomes "7 of 8 skills". */
export function compactReason(label: string): string {
  const base = (label.split(':')[0] ?? label).trim();
  return base.replace(/\brequired skills\b/i, 'skills');
}

function lowerFirst(s: string): string {
  // Leave acronyms and proper nouns ("ML", "UC Berkeley") alone.
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** One line for a table cell: the top reasons joined, e.g. "7 of 8 skills · same job family". */
export function whyLine(reasons: Reason[], max = 2): string {
  return reasons
    .slice(0, max)
    .map((r) => compactReason(r.label))
    .filter(Boolean)
    .map((label, i) => (i === 0 ? label : lowerFirst(label)))
    .join(' · ');
}
