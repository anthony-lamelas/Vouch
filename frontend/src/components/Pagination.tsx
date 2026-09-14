import { Button } from './Button';
import { formatCount } from '../lib/format';

export function Pagination({
  total,
  limit,
  offset,
  onPage,
  noun = 'results',
}: {
  total: number;
  limit: number;
  offset: number;
  onPage: (offset: number) => void;
  noun?: string;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-[13.5px] text-muted tnum">
      <span>
        {formatCount(from)}–{formatCount(to)} of {formatCount(total)} {noun}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          disabled={offset === 0}
          onClick={() => onPage(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button size="sm" disabled={to >= total} onClick={() => onPage(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  );
}
