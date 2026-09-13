import { Link } from 'react-router-dom';
import { useOutreach } from '../api/queries';
import { DeliveryMark } from '../components/DeliveryMark';
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { formatCount, formatDateTime, formatRelative, truncate } from '../lib/format';

export function OutreachPage() {
  const outreach = useOutreach();
  const items = outreach.data ?? [];
  return (
    <div>
      <PageHeader
        title="Outreach"
        subtitle="Every message VOUCH sent to an employee, newest first, so you can follow what they received without opening Slack."
      />
      {outreach.isPending ? <TableSkeleton rows={6} cols={6} /> : null}
      {outreach.isError ? (
        <ErrorState title="Couldn't load outreach" error={outreach.error} />
      ) : null}
      {outreach.data && items.length === 0 ? (
        <EmptyState title="Nothing sent yet">
          Request a referral from a role page and the message to the employee will show up here.
        </EmptyState>
      ) : null}
      {items.length > 0 ? (
        <>
          <p className="mb-2 text-[12.5px] text-muted tnum">
            {formatCount(items.length)} {items.length === 1 ? 'message' : 'messages'}
          </p>
          <div className="rounded-md border border-line bg-surface overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sent to</th>
                  <th>About</th>
                  <th className="w-[36%]">Message</th>
                  <th>Delivery</th>
                  <th>Request now</th>
                  <th className="num">When</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.message.id}>
                    <td>
                      <div className="font-medium text-ink">{it.message.employee.full_name}</div>
                      <div className="text-[12px] text-muted">
                        {it.message.employee.title}
                        {it.message.employee.team ? `, ${it.message.employee.team}` : ''}
                      </div>
                    </td>
                    <td>
                      <div className="text-ink">{it.contact.full_name}</div>
                      <div className="text-[12px] text-muted">for {it.role.title}</div>
                    </td>
                    <td className="text-ink-2 text-[12.5px] leading-snug">
                      <p className="m-0">{truncate(it.message.body, 200)}</p>
                      <Link to={`/requests/${it.request_id}`} className="link text-[12px]">
                        Open request
                      </Link>
                    </td>
                    <td>
                      <DeliveryMark
                        delivered={it.message.delivered}
                        error={it.message.error}
                        channel={it.message.channel}
                      />
                    </td>
                    <td>
                      <StatusPill status={it.request_status} />
                    </td>
                    <td
                      className="num tnum text-ink-2 whitespace-nowrap"
                      title={formatDateTime(it.message.created_at)}
                    >
                      {formatRelative(it.message.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
