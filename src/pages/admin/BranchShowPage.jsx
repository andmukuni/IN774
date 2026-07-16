import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader, Card, Spinner, RecordDetailView, branchDetailFields, DataTable } from '../../components/ui';
import RecordShowActions from '../../components/admin/RecordShowActions';
import { useFetchRecord } from '../../hooks/useFetchRecord';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import {
  productStatusHtml,
  skuHtml,
  qtyHtml,
  dateHtml,
  currencyHtml,
  employeeCodeHtml,
} from '../../utils/datatableHelpers';

const branchItemColumns = [
  {
    key: 'sku',
    label: 'S/N',
    render: (_, row) => skuHtml(row.sku, row.name),
  },
  { key: 'category', label: 'Category' },
  {
    key: 'brandName',
    label: 'Brand',
    render: (_, row) => row.brandName || '—',
  },
  {
    key: 'employeeName',
    label: 'Assigned to',
    render: (_, row) => (
      row.employeeName
        ? employeeCodeHtml(row.employeeCode, row.employeeName)
        : 'Branch asset'
    ),
  },
  {
    key: 'quantity',
    label: 'Qty',
    render: (_, row) => qtyHtml(row.quantity, row.reorderLevel),
  },
  {
    key: 'unitPrice',
    label: 'Price (K)',
    render: (_, row) => currencyHtml(row.unitPrice),
  },
  {
    key: 'status',
    label: 'Status',
    render: (_, row) => productStatusHtml(row.status),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    render: (_, row) => dateHtml(row.updatedAt),
  },
];

export default function BranchShowPage() {
  const { id } = useParams();
  const { record, loading, error } = useFetchRecord('/admin/branches', id);
  const deleteRecord = useDeleteRecord('/admin/branches', {
    redirectTo: '/admin/branches',
    successMessage: 'Branch deleted.',
  });

  const ajaxParams = useMemo(() => ({ branchId: id }), [id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={record?.name || 'Branch'}
        subtitle={record?.code || 'Branch details'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Branches', to: '/admin/branches' },
          { label: record?.code || 'View' },
        ]}
        actions={(
          <RecordShowActions
            backTo="/admin/branches"
            backLabel="Back to branches"
            editTo={id ? `/admin/branches/${id}/edit` : undefined}
            onDelete={id ? () => deleteRecord(id) : undefined}
            deleteTitle="Delete branch"
            deleteMessage={`Delete ${record?.code || 'this branch'}? Branches with employees cannot be deleted.`}
          />
        )}
      />

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {!loading && error && (
        <Card title="Unable to load branch">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!loading && !error && record && (
        <>
          <Card title="Public equipment form" className="max-w-3xl">
            <p className="text-sm text-navy-600 mb-3">
              Share this link with branch staff to report computers and printers in use.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                readOnly
                className="flex-1 rounded-xl border border-navy-200 bg-navy-50 px-4 py-2.5 text-sm text-navy-800"
                value={`${window.location.origin}/intake/${record.code}`}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/intake/${record.code}`);
                }}
                className="shrink-0 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
              >
                Copy link
              </button>
            </div>
          </Card>

          <Card title="Branch details" className="max-w-3xl">
            <RecordDetailView record={record} fields={branchDetailFields} />
          </Card>

          <Card
            title="Branch inventory"
            subtitle="All products at this branch — employee devices and shared branch assets"
            noPadding
          >
            <DataTable
              columns={branchItemColumns}
              serverSide
              ajaxUrl="/admin/items"
              ajaxParams={ajaxParams}
              pageLength={10}
              emptyTitle="No products recorded at this branch"
              getRowHref={(row) => `/admin/items/${row.id}`}
              tableKey={`branch-items-${id}`}
            />
          </Card>
        </>
      )}
    </div>
  );
}
