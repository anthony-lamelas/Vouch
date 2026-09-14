import { useEffect, type ReactNode, type RefObject } from 'react';

/**
 * A small anchored panel. The caller owns the trigger and wraps trigger + popover in one
 * positioned element (`rootRef`) so clicks on the trigger don't count as outside clicks.
 */
export function Popover({
  open,
  onClose,
  rootRef,
  label,
  children,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  rootRef: RefObject<HTMLElement>;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, rootRef]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label={label}
      className={`absolute right-0 top-[calc(100%+6px)] z-30 rounded-card border border-line bg-canvas p-3 shadow-pop ${className}`}
    >
      {children}
    </div>
  );
}
