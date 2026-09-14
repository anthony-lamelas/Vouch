export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'text-[20px]' : 'text-[15px]';
  return (
    <span
      className={`font-semibold leading-none tracking-[-0.01em] text-ink select-none ${cls}`}
      aria-label="VOUCH"
    >
      VOUCH
    </span>
  );
}
