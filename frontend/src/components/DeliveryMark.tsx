function describeDeliveryError(error: string | null): string {
  if (!error) return 'Not delivered';
  if (error === 'slack_disabled') return 'Slack is not configured in this environment';
  return error;
}

/** A small check for a delivered message; text otherwise. */
export function DeliveryCheck({ delivered, error }: { delivered: boolean; error: string | null }) {
  if (delivered) {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        role="img"
        aria-label="Delivered"
        className="inline-block shrink-0 align-[-1px] text-pos"
      >
        <path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <span className="text-[12.5px] text-muted" title={describeDeliveryError(error)}>
      Not delivered
    </span>
  );
}

export function DeliveryMark({
  delivered,
  error,
  channel,
}: {
  delivered: boolean;
  error: string | null;
  channel: string;
}) {
  const channelLabel = channel === 'slack' ? 'Slack' : channel;
  if (delivered) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-pos">
        <DeliveryCheck delivered error={null} />
        Delivered via {channelLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col text-[13px] text-ink-2">
      <span>Not delivered</span>
      <span className="text-[12.5px] text-muted">{describeDeliveryError(error)}</span>
    </span>
  );
}
