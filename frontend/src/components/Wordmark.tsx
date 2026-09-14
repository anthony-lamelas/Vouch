export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'text-[30px]' : 'text-[18px]';
  return (
    <span
      className={`font-serif italic font-normal leading-none tracking-[0.01em] text-ink select-none ${cls}`}
      aria-label="VOUCH"
    >
      VOUCH
    </span>
  );
}
