import { useParams } from 'react-router-dom';
import { PageHeader, Card, Spinner, RecordDetailView, userDetailFields } from '../../components/ui';
import RecordShowActions from '../../components/admin/RecordShowActions';
import { useFetchRecord } from '../../hooks/useFetchRecord';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';

export default function UserShowPage() {
  const { id } = useParams();
  const { record, loading, error } = useFetchRecord('/admin/users', id);
  const deleteRecord = useDeleteRecord('/admin/users', {
    redirectTo: '/admin/users',
    successMessage: 'User deleted.',
  });

  return (
    <div>
      <PageHeader
        title={record?.name || 'User'}
        subtitle={record?.email || 'User details'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Users', to: '/admin/users' },
          { label: record?.name || 'View' },
        ]}
        actions={(
          <RecordShowActions
            backTo="/admin/users"
            backLabel="Back to users"
            editTo={id ? `/admin/users/${id}/edit` : undefined}
            onDelete={id ? () => deleteRecord(id) : undefined}
            deleteTitle="Delete user"
            deleteMessage={`Delete ${record?.email || 'this user'}? You cannot delete your own account.`}
          />
        )}
      />

      <Card title="User details" className="max-w-3xl">
        {loading && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}
        {!loading && error && (
          <p className="text-sm text-red-600 py-4">{error}</p>
        )}
        {!loading && !error && record && (
          <RecordDetailView record={record} fields={userDetailFields} />
        )}
      </Card>
    </div>
  );
}
