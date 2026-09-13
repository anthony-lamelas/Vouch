function describeDeliveryError(error: string | null): string {
  if (!error) return 'Not delivered';
  if (error === 'slack_disabled') return 'Slack not configured in this environment';
  return error;
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
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-pos">
        <span className="size-1.5 rounded-full bg-pos" aria-hidden />
        Delivered via {channelLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col text-[12.5px] text-ink-2">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-faint" aria-hidden />
        Not delivered
      </span>
      <span className="text-[11.5px] text-muted">{describeDeliveryError(error)}</span>
    </span>
  );
}
