import { useParams } from 'react-router-dom';
import { PageHeader, Card, Spinner, RecordDetailView, productDetailFields } from '../../components/ui';
import RecordShowActions from '../../components/admin/RecordShowActions';
import ItemArchitectureDiagram from '../../components/admin/ItemArchitectureDiagram';
import ItemMovementHistory from '../../components/admin/ItemMovementHistory';
import { useFetchRecord } from '../../hooks/useFetchRecord';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';

export default function ItemShowPage() {
  const { id } = useParams();
  const { record, loading, error } = useFetchRecord('/admin/items', id);
  const deleteRecord = useDeleteRecord('/admin/items', {
    redirectTo: '/admin/items',
    successMessage: 'Product deleted.',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={record?.name || 'Product'}
        subtitle={record?.sku || 'Product details'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Products', to: '/admin/items' },
          { label: record?.sku || 'View' },
        ]}
        actions={(
          <RecordShowActions
            backTo="/admin/items"
            backLabel="Back to products"
            editTo={id ? `/admin/items/${id}/edit` : undefined}
            onDelete={id ? () => deleteRecord(id) : undefined}
            deleteTitle="Delete product"
            deleteMessage={`Delete ${record?.sku || 'this product'}? This cannot be undone.`}
          />
        )}
      />

      {loading && (
        <Card>
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <p className="text-sm text-red-600 py-4">{error}</p>
        </Card>
      )}

      {!loading && !error && record && (
        <div className="space-y-6">
          <Card
            title="Architecture & network"
            subtitle="How this item connects within the branch"
          >
            <ItemArchitectureDiagram architecture={record.architecture} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Card title="Product details">
              <RecordDetailView record={record} fields={productDetailFields} />
            </Card>

            <Card
              title="Movement history"
              subtitle={`${record.history?.length || 0} recorded event${record.history?.length === 1 ? '' : 's'}`}
            >
              <ItemMovementHistory history={record.history} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
