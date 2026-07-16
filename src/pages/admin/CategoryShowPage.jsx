import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader, Card, Spinner, RecordDetailView, productTypeDetailFields, DataTable } from '../../components/ui';
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

const categoryItemColumns = [
  {
    key: 'sku',
    label: 'S/N',
    render: (_, row) => skuHtml(row.sku, row.name),
  },
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

export default function CategoryShowPage() {
  const { id } = useParams();
  const { record, loading, error } = useFetchRecord('/admin/product-types', id);
  const deleteRecord = useDeleteRecord('/admin/product-types', {
    redirectTo: '/admin/categories',
    successMessage: 'Product type deleted.',
  });

  const ajaxParams = useMemo(
    () => (record?.name ? { category: record.name } : {}),
    [record?.name],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={record?.name || 'Product Type'}
        subtitle={record?.code || 'Device category details'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Product Types', to: '/admin/categories' },
          { label: record?.code || 'View' },
        ]}
        actions={(
          <RecordShowActions
            backTo="/admin/categories"
            backLabel="Back to product types"
            editTo={id ? `/admin/categories/${id}/edit` : undefined}
            onDelete={id ? () => deleteRecord(id) : undefined}
            deleteTitle="Delete product type"
            deleteMessage={`Delete ${record?.name || 'this product type'}? Types assigned to inventory items cannot be deleted.`}
          />
        )}
      />

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {!loading && error && (
        <Card title="Unable to load product type">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!loading && !error && record && (
        <>
          <Card title="Product type details" className="max-w-3xl">
            <RecordDetailView record={record} fields={productTypeDetailFields} />
          </Card>

          <Card
            title="Inventory items"
            subtitle={`Products classified as ${record.name}`}
            noPadding
          >
            <DataTable
              columns={categoryItemColumns}
              serverSide
              ajaxUrl="/admin/items"
              ajaxParams={ajaxParams}
              pageLength={10}
              emptyTitle="No products in this category"
              getRowHref={(row) => `/admin/items/${row.id}`}
              tableKey={`category-items-${id}`}
            />
          </Card>
        </>
      )}
    </div>
  );
}
