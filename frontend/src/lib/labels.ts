/** Human labels for taxonomy values the API returns as identifiers. */
const SENIORITY: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff',
  lead: 'Lead',
  director: 'Director',
  vp: 'VP',
};

export function seniorityLabel(value: string): string {
  return SENIORITY[value] ?? value;
}

export function familyLabel(value: string): string {
  if (value === 'ml_research') return 'ML research';
  const words = value.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
