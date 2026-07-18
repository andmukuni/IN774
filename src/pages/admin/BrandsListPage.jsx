import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Card,
  ConfirmDialog,
  DynamicListFilters,
  TableActionsMenu,
} from '../../components/ui';
import { branchStatusHtml, catalogRowActionsHtml, dateHtml, textHtml } from '../../utils/datatableHelpers';
import { useAuth } from '../../context/AuthContext';
import { useAdminTablePage } from '../../hooks/useAdminTablePage';
import {
  BRAND_FILTER_FIELDS,
  buildInitialFilters,
  buildListExportParams,
} from '../../config/adminListPageConfig';

export default function BrandsListPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('items.manage');
  const canView = hasPermission('items.view');
  const [filters, setFilters] = useState(() => buildInitialFilters(BRAND_FILTER_FIELDS));
  const [appliedFilters, setAppliedFilters] = useState(() => buildInitialFilters(BRAND_FILTER_FIELDS));

  const {
    tableRef,
    selectedCount,
    clearSelection,
    deleting,
    updatingStatus,
    busy,
    deleteTarget,
    statusTarget,
    setDeleteTarget,
    setStatusTarget,
    handleDeleteConfirm,
    handleStatusConfirm,
    buildTableActions,
    selectable,
  } = useAdminTablePage({
    canView,
    canManage,
    exportPath: '/admin/brands/export',
    exportFilename: 'brands',
    buildExportParams: (nextFilters, selectedIds) => buildListExportParams(nextFilters, selectedIds),
    bulkDeletePath: '/admin/brands/bulk-delete',
    bulkStatusPath: '/admin/brands/bulk-status',
    entityLabel: 'brand',
    entityLabelPlural: 'brands',
  });

  const columns = useMemo(() => [
    { key: 'code', label: 'Code', render: (_, row) => textHtml(row.code) },
    { key: 'name', label: 'Brand', render: (_, row) => textHtml(row.name) },
    { key: 'status', label: 'Status', render: (_, row) => branchStatusHtml(row.status) },
    { key: 'updatedAt', label: 'Updated', render: (_, row) => dateHtml(row.updatedAt) },
    {
      key: 'actions',
      label: 'Actions',
      orderable: false,
      sortable: false,
      className: 'dt-right',
      render: (_, row) => catalogRowActionsHtml('/admin/brands', row, { canManage }),
    },
  ], [canManage]);

  const ajaxParams = useMemo(() => ({ ...appliedFilters }), [appliedFilters]);
  const tableActions = useMemo(() => buildTableActions({
    appliedFilters,
    statusActions: [
      { key: 'status-active', label: 'Mark active', status: 'active' },
      { key: 'status-inactive', label: 'Mark inactive', status: 'inactive' },
    ],
  }), [appliedFilters, buildTableActions]);

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

      <DynamicListFilters
        fields={BRAND_FILTER_FIELDS}
        values={filters}
        onChange={setFilters}
        onApply={(next) => {
          setAppliedFilters(next);
          clearSelection();
        }}
        onClear={() => {
          const cleared = buildInitialFilters(BRAND_FILTER_FIELDS);
          setFilters(cleared);
          setAppliedFilters(cleared);
          clearSelection();
        }}
      />

      <Card
        noPadding
        actions={(canView || canManage) ? (
          <TableActionsMenu selectedCount={selectedCount} disabled={busy} actions={tableActions} />
        ) : null}
      >
        <DataTable
          ref={tableRef}
          columns={columns}
          serverSide
          ajaxUrl="/admin/brands"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No brands found"
          getRowHref={(row) => `/admin/brands/${row.id}`}
          selectable={selectable}
          tableKey={`brands-${Object.values(appliedFilters).join('-')}-${canManage ? 'manage' : 'view'}`}
        />
      </Card>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete selected brands"
        message={`Delete ${deleteTarget?.count || 0} selected brand(s)? Brands linked to products will be skipped.`}
        confirmLabel="Delete"
        loading={deleting}
      />

      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        onClose={() => !updatingStatus && setStatusTarget(null)}
        onConfirm={handleStatusConfirm}
        title="Change brand status"
        message={`Mark ${statusTarget?.count || 0} selected brand(s) as ${statusTarget?.label || statusTarget?.status || ''}?`}
        confirmLabel="Update status"
        loading={updatingStatus}
      />
    </div>
  );
}
