import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import {
  PageHeader,
  Card,
  DataTable,
  Spinner,
  DynamicListFilters,
  TableActionsMenu,
} from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';
import { useAdminTablePage } from '../../hooks/useAdminTablePage';
import {
  USER_FILTER_FIELDS,
  buildInitialFilters,
  buildListExportParams,
} from '../../config/adminListPageConfig';

const API_BASE = getApiBase();

function matchesFilters(user, filters) {
  const name = String(filters.name || '').trim().toLowerCase();
  const email = String(filters.email || '').trim().toLowerCase();
  const role = String(filters.role || '').trim().toLowerCase();

  if (name && !String(user.name || '').toLowerCase().includes(name)) return false;
  if (email && !String(user.email || '').toLowerCase().includes(email)) return false;
  if (role && !String(user.role || '').toLowerCase().includes(role)) return false;
  return true;
}

export default function DemoUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => buildInitialFilters(USER_FILTER_FIELDS));
  const [appliedFilters, setAppliedFilters] = useState(() => buildInitialFilters(USER_FILTER_FIELDS));

  const {
    selectedCount,
    clearSelection,
    busy,
    buildTableActions,
    selectable,
  } = useAdminTablePage({
    canView: true,
    canManage: false,
    exportPath: '/admin/users/export',
    exportFilename: 'users',
    buildExportParams: (nextFilters, nextSelectedIds) => buildListExportParams(nextFilters, nextSelectedIds),
    entityLabel: 'user',
    entityLabelPlural: 'users',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/users`, {
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || 'Failed to load users');
        }
        if (!cancelled) setUsers(json.data || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Unable to load users.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const displayUsers = useMemo(
    () => users.filter((user) => matchesFilters(user, appliedFilters)),
    [appliedFilters, users],
  );

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    {
      key: 'email_verified',
      label: 'Verified',
      render: (_, row) => (row.email_verified ? 'Yes' : 'No'),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (_, row) => formatDate(row.created_at),
    },
  ];

  const tableActions = useMemo(() => buildTableActions({
    appliedFilters,
    includeDelete: false,
    statusActions: [],
  }), [appliedFilters, buildTableActions]);

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Live user list from MySQL"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Users' },
        ]}
        actions={(
          <Link
            to="/admin/users/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Add user
          </Link>
        )}
      />

      <DynamicListFilters
        fields={USER_FILTER_FIELDS}
        values={filters}
        onChange={setFilters}
        onApply={(next) => {
          setAppliedFilters(next);
          clearSelection();
        }}
        onClear={() => {
          const cleared = buildInitialFilters(USER_FILTER_FIELDS);
          setFilters(cleared);
          setAppliedFilters(cleared);
          clearSelection();
        }}
      />

      <Card
        noPadding
        actions={(
          <TableActionsMenu selectedCount={selectedCount} disabled={busy || loading} actions={tableActions} />
        )}
      >
        {loading && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}
        {!loading && error && (
          <p className="text-sm text-red-600 py-4 px-6">{error}</p>
        )}
        {!loading && !error && (
          <DataTable
            columns={columns}
            data={displayUsers}
            emptyTitle="No users yet"
            getRowHref={(row) => `/admin/users/${row.id}`}
            selectable={selectable}
            tableKey={`users-${Object.values(appliedFilters).join('-')}`}
          />
        )}
      </Card>
    </div>
  );
}
