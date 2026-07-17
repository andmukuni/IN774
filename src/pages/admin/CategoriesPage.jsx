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
  PRODUCT_TYPE_FILTER_FIELDS,
  buildInitialFilters,
  buildListExportParams,
} from '../../config/adminListPageConfig';

export default function CategoriesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('items.manage');
  const canView = hasPermission('items.view');
  const [filters, setFilters] = useState(() => buildInitialFilters(PRODUCT_TYPE_FILTER_FIELDS));
  const [appliedFilters, setAppliedFilters] = useState(() => buildInitialFilters(PRODUCT_TYPE_FILTER_FIELDS));

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
    exportPath: '/admin/product-types/export',
    exportFilename: 'product-types',
    buildExportParams: (nextFilters, selectedIds) => buildListExportParams(nextFilters, selectedIds),
    bulkDeletePath: '/admin/product-types/bulk-delete',
    bulkStatusPath: '/admin/product-types/bulk-status',
    entityLabel: 'product type',
    entityLabelPlural: 'product types',
  });

  const columns = useMemo(() => [
    { key: 'code', label: 'Code', render: (_, row) => textHtml(row.code) },
    { key: 'name', label: 'Type', render: (_, row) => textHtml(row.name) },
    { key: 'description', label: 'Description', render: (_, row) => textHtml(row.description) },
    { key: 'status', label: 'Status', render: (_, row) => branchStatusHtml(row.status) },
    { key: 'updatedAt', label: 'Updated', render: (_, row) => dateHtml(row.updatedAt) },
    {
      key: 'actions',
      label: 'Actions',
      orderable: false,
      sortable: false,
      className: 'dt-right',
      render: (_, row) => catalogRowActionsHtml('/admin/categories', row, { canManage }),
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
        title="Product Types"
        subtitle="Device categories — Monitor, TV, Desktop, Laptop, Printer, etc."
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Inventory', to: '/admin/items' },
          { label: 'Product Types' },
        ]}
        actions={canManage ? (
          <Link
            to="/admin/categories/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Add product type
          </Link>
        ) : null}
      />

      <p className="mb-4 text-sm text-navy-600 max-w-3xl">
        <span className="font-medium text-navy-800">Product type</span> describes what the asset is
        (Monitor, TV, Desktop). <span className="font-medium text-navy-800">Brand</span> is who made it
        (HP, Dell) — see the <Link to="/admin/brands" className="text-cyan-700 hover:underline">Brands</Link> page.
      </p>

      <DynamicListFilters
        fields={PRODUCT_TYPE_FILTER_FIELDS}
        values={filters}
        onChange={setFilters}
        onApply={(next) => {
          setAppliedFilters(next);
          clearSelection();
        }}
        onClear={() => {
          const cleared = buildInitialFilters(PRODUCT_TYPE_FILTER_FIELDS);
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
          ajaxUrl="/admin/product-types"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No product types found"
          getRowHref={(row) => `/admin/categories/${row.id}`}
          selectable={selectable}
          tableKey={`product-types-${Object.values(appliedFilters).join('-')}-${canManage ? 'manage' : 'view'}`}
        />
      </Card>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete selected product types"
        message={`Delete ${deleteTarget?.count || 0} selected product type(s)? Types linked to products will be skipped.`}
        confirmLabel="Delete"
        loading={deleting}
      />

      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        onClose={() => !updatingStatus && setStatusTarget(null)}
        onConfirm={handleStatusConfirm}
        title="Change product type status"
        message={`Mark ${statusTarget?.count || 0} selected product type(s) as ${statusTarget?.label || statusTarget?.status || ''}?`}
        confirmLabel="Update status"
        loading={updatingStatus}
      />
    </div>
  );
}
