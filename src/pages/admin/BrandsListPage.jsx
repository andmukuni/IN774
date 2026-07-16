import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { PageHeader, DataTable, Card, ListSearchFilters, emptySearchFilters } from '../../components/ui';
import { branchStatusHtml, dateHtml, textHtml, catalogRowActionsHtml } from '../../utils/datatableHelpers';
import { useAuth } from '../../context/AuthContext';

export default function BrandsListPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('items.manage');
  const tableRef = useRef(null);
  const [filters, setFilters] = useState(emptySearchFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptySearchFilters);

  const reloadTable = useCallback(() => {
    tableRef.current?.reload(false);
  }, []);

  const columns = useMemo(() => [
    { key: 'code', label: 'Code', render: (_, row) => textHtml(row.code) },
    { key: 'name', label: 'Brand', render: (_, row) => textHtml(row.name) },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => branchStatusHtml(row.status),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      render: (_, row) => dateHtml(row.updatedAt),
    },
    {
      key: 'actions',
      label: 'Actions',
      orderable: false,
      sortable: false,
      className: 'dt-right',
      render: (_, row) => catalogRowActionsHtml('/admin/brands', row, { canManage }),
    },
  ], [canManage]);

  const ajaxParams = useMemo(() => ({
    search: appliedFilters.search,
  }), [appliedFilters.search]);

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Computer and electronics manufacturers (HP, Dell, Kyocera, etc.)"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Inventory', to: '/admin/items' },
          { label: 'Brands' },
        ]}
        actions={canManage ? (
          <Link
            to="/admin/brands/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Add brand
          </Link>
        ) : null}
      />

      <ListSearchFilters
        values={filters}
        onChange={setFilters}
        onApply={(next) => {
          setAppliedFilters(next);
          reloadTable();
        }}
        onClear={() => {
          const cleared = emptySearchFilters();
          setFilters(cleared);
          setAppliedFilters(cleared);
          reloadTable();
        }}
        placeholder="Search brand code or name..."
      />

      <Card noPadding>
        <DataTable
          ref={tableRef}
          columns={columns}
          serverSide
          ajaxUrl="/admin/brands"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No brands found"
          getRowHref={(row) => `/admin/brands/${row.id}`}
          tableKey={`brands-${appliedFilters.search}`}
        />
      </Card>
    </div>
  );
}
