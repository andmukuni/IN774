import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader, Card, DataTable, Spinner, StatusBadge } from '../../components/ui';
import { useFetchRecord } from '../../hooks/useFetchRecord';
import { dateHtml, textHtml } from '../../utils/datatableHelpers';
import { formatDate } from '../../utils/helpers';

function deliveryStatusHtml(status) {
  const key = String(status || 'pending').toLowerCase();
  const labels = {
    pending: 'Pending',
    sent: 'Sent',
    failed: 'Failed',
    clicked: 'Clicked link',
    submitted: 'Submitted',
  };
  const badgeClass = key === 'submitted' ? 'processed' : key === 'clicked' ? 'submitted' : key === 'failed' ? 'cancelled' : key === 'sent' ? 'draft' : 'draft';
  return `<span class="dt-badge dt-badge-${badgeClass}">${labels[key] || key}</span>`;
}

export default function EmployeeReminderShowPage() {
  const { id } = useParams();
  const { record: session, loading, error } = useFetchRecord('/admin/reminders/sessions', id);

  const columns = useMemo(() => [
    {
      key: 'employeeName',
      label: 'Employee',
      render: (_, row) => textHtml(row.employeeName),
    },
    {
      key: 'recipientEmail',
      label: 'Email',
      render: (_, row) => textHtml(row.recipientEmail),
    },
    {
      key: 'branchName',
      label: 'Branch',
      render: (_, row) => textHtml(row.branchName || '—'),
    },
    {
      key: 'missingFields',
      label: 'Missing',
      render: (_, row) => textHtml((row.missingFields || []).join(', ') || '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => deliveryStatusHtml(row.status),
    },
    {
      key: 'clickedAt',
      label: 'Clicked',
      render: (_, row) => dateHtml(row.clickedAt),
    },
    {
      key: 'submittedAt',
      label: 'Submitted',
      render: (_, row) => dateHtml(row.submittedAt),
    },
    {
      key: 'sentAt',
      label: 'Sent',
      render: (_, row) => dateHtml(row.sentAt),
    },
  ], []);

  const ajaxParams = useMemo(() => ({ search: '' }), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={session?.name || 'Reminder session'}
        subtitle={session?.branchName ? `${session.branchName} · delivery report` : 'All branches · delivery report'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Employee reminders', to: '/admin/employee-reminders' },
          { label: session?.name || 'Session' },
        ]}
        actions={(
          <Link
            to="/admin/employee-reminders"
            className="inline-flex items-center rounded-xl border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
          >
            Back to sessions
          </Link>
        )}
      />

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {!loading && error && (
        <Card title="Unable to load session">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!loading && !error && session && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="!p-4">
              <p className="text-xs uppercase tracking-wide text-navy-400">Recipients</p>
              <p className="mt-1 text-2xl font-semibold text-navy-900">{session.totalRecipients ?? 0}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs uppercase tracking-wide text-navy-400">Sent</p>
              <p className="mt-1 text-2xl font-semibold text-navy-900">{session.sentCount ?? 0}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs uppercase tracking-wide text-navy-400">Clicked</p>
              <p className="mt-1 text-2xl font-semibold text-navy-900">{session.clickedCount ?? 0}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs uppercase tracking-wide text-navy-400">Submitted</p>
              <p className="mt-1 text-2xl font-semibold text-navy-900">{session.submittedCount ?? 0}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs uppercase tracking-wide text-navy-400">Failed</p>
              <p className="mt-1 text-2xl font-semibold text-navy-900">{session.failedCount ?? 0}</p>
            </Card>
          </div>

          <Card title="Session details">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Status</dt>
                <dd className="mt-1"><StatusBadge status={session.status} /></dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Branch scope</dt>
                <dd className="mt-1 text-sm text-navy-900">{session.branchName || 'All branches'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Sent at</dt>
                <dd className="mt-1 text-sm text-navy-900">{formatDate(session.sentAt || session.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-navy-400">Updated</dt>
                <dd className="mt-1 text-sm text-navy-900">{formatDate(session.updatedAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Delivery report" subtitle="Who received, opened, and completed the reminder link" noPadding>
            <DataTable
              columns={columns}
              serverSide
              ajaxUrl={`/admin/reminders/sessions/${id}/deliveries`}
              ajaxParams={ajaxParams}
              pageLength={25}
              emptyTitle="No deliveries in this session"
              rowClickable={false}
              tableKey={`employee-reminder-deliveries-${id}`}
            />
          </Card>
        </>
      )}
    </div>
  );
}
