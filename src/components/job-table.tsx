import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { DateText, Empty, Status } from './shared';
export type Job = {
  id: string;
  title: string;
  module_id: string;
  status: string;
  credits_charged: number;
  created_at: string;
};
export function JobTable({ jobs }: { jobs: Job[] }) {
  if (!jobs.length)
    return (
      <Empty
        title="Your first insight starts here"
        description="Choose a service and upload your documents. Your analyses will appear here."
      />
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Analysis</th>
            <th>Service</th>
            <th>Status</th>
            <th>Credits</th>
            <th>Created (UTC)</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                <Link className="link" href={`/dashboard/analyses/${j.id}`}>
                  {j.title}
                </Link>
              </td>
              <td>{j.module_id === 'quotation' ? 'Supplier quotation' : 'E-commerce'}</td>
              <td>
                <Status status={j.status} />
              </td>
              <td>
                {j.credits_charged}
                {j.status === 'failed' ? ' · refunded' : ''}
              </td>
              <td>
                <DateText value={j.created_at} />
              </td>
              <td>
                <Link aria-label={`Open ${j.title}`} href={`/dashboard/analyses/${j.id}`}>
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
