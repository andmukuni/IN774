import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader, Card, Spinner, RecordDetailView, brandDetailFields, DataTable } from '../../components/ui';
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

const brandItemColumns = [
  {
    key: 'sku',
    label: 'S/N',
    render: (_, row) => skuHtml(row.sku, row.name),
  },
  { key: 'category', label: 'Category' },
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

export default function BrandShowPage() {
  const { id } = useParams();
  const { record, loading, error } = useFetchRecord('/admin/brands', id);
  const deleteRecord = useDeleteRecord('/admin/brands', {
    redirectTo: '/admin/brands',
    successMessage: 'Brand deleted.',
  });

  const ajaxParams = useMemo(
    () => (id ? { brandId: id } : {}),
    [id],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={record?.name || 'Brand'}
        subtitle={record?.code || 'Manufacturer details'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Brands', to: '/admin/brands' },
          { label: record?.code || 'View' },
        ]}
        actions={(
          <RecordShowActions
            backTo="/admin/brands"
            backLabel="Back to brands"
            editTo={id ? `/admin/brands/${id}/edit` : undefined}
            onDelete={id ? () => deleteRecord(id) : undefined}
            deleteTitle="Delete brand"
            deleteMessage={`Delete ${record?.name || 'this brand'}? Brands assigned to inventory items cannot be deleted.`}
          />
        )}
      />

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {!loading && error && (
        <Card title="Unable to load brand">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!loading && !error && record && (
        <>
          <Card title="Brand details" className="max-w-3xl">
            <RecordDetailView record={record} fields={brandDetailFields} />
          </Card>

          <Card
            title="Inventory items"
            subtitle={`Products from ${record.name}`}
            noPadding
          >
            <DataTable
              columns={brandItemColumns}
              serverSide
              ajaxUrl="/admin/items"
              ajaxParams={ajaxParams}
              pageLength={10}
              emptyTitle="No products for this brand"
              getRowHref={(row) => `/admin/items/${row.id}`}
              tableKey={`brand-items-${id}`}
            />
          </Card>
        </>
      )}
    </div>
  );
}
