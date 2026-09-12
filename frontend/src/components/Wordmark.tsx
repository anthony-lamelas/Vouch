export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'text-[34px] leading-none' : 'text-[19px] leading-none';
  return (
    <span className={`wordmark ${cls} text-ink select-none`} aria-label="VOUCH">
      <span>V</span>
      <span className="text-accent">O</span>
      <span>UCH</span>
    </span>
  );
}
