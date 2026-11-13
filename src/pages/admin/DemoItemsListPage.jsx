import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Card,
  ConfirmDialog,
  DynamicListFilters,
  TableActionsMenu,
} from '../../components/ui';
import {
  branchCodeHtml,
  catalogRowActionsHtml,
  currencyHtml,
  dateHtml,
  employeeCodeHtml,
  productStatusHtml,
  qtyHtml,
  textHtml,
} from '../../utils/datatableHelpers';
import { useAuth } from '../../context/AuthContext';
import { useAdminTablePage } from '../../hooks/useAdminTablePage';
import {
  PRODUCT_FILTER_FIELDS,
  buildBranchOptions,
  buildBrandOptions,
  buildInitialFilters,
  buildListExportParams,
} from '../../config/adminListPageConfig';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';
import { useToast } from '../../context/ToastContext';

const API_BASE = getApiBase();

export default function DemoItemsListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('items.manage');
  const canView = hasPermission('items.view');
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status') || '';
  const [branches, setBranches] = useState([]);
  const [brands, setBrands] = useState([]);
  const [filters, setFilters] = useState(() => buildInitialFilters(PRODUCT_FILTER_FIELDS, { status: statusFromUrl }));
  const [appliedFilters, setAppliedFilters] = useState(() => buildInitialFilters(PRODUCT_FILTER_FIELDS, { status: statusFromUrl }));

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
    handleDeleteRequest,
    handleDeleteConfirm,
    handleStatusConfirm,
    buildTableActions,
    selectable,
  } = useAdminTablePage({
    canView,
    canManage,
    exportPath: '/admin/items/export',
    exportFilename: 'products',
    buildExportParams: (nextFilters, selectedIds) => buildListExportParams(nextFilters, selectedIds),
    bulkDeletePath: '/admin/items/bulk-delete',
    bulkStatusPath: '/admin/items/bulk-status',
    singleDeletePath: '/admin/items',
    entityLabel: 'product',
    entityLabelPlural: 'products',
    singleDeleteSuccessMessage: 'Product deleted.',
  });

  useEffect(() => {
    const next = buildInitialFilters(PRODUCT_FILTER_FIELDS, { status: statusFromUrl });
    setFilters(next);
    setAppliedFilters(next);
    clearSelection();
  }, [clearSelection, statusFromUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = getAdminAuthHeaders();
        const [branchRes, brandRes] = await Promise.all([
          fetch(`${API_BASE}/admin/branches?limit=100`, { headers, cache: 'no-store' }),
          fetch(`${API_BASE}/admin/brands?limit=100`, { headers, cache: 'no-store' }),
        ]);
        const branchJson = await branchRes.json().catch(() => ({}));
        const brandJson = await brandRes.json().catch(() => ({}));
        if (!cancelled) {
          if (branchRes.ok && branchJson?.ok) setBranches(branchJson.data || []);
          if (brandRes.ok && brandJson?.ok) setBrands(brandJson.data || []);
        }
      } catch {
        if (!cancelled) toast('Unable to load filter options.', { type: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const pageTitle = useMemo(() => {
    if (appliedFilters.status === 'low_stock') return 'Low Stock Products';
    if (appliedFilters.status === 'out_of_stock') return 'Out of Stock Products';
    return 'Products';
  }, [appliedFilters.status]);

  const columns = useMemo(() => [
    { key: 'sku', label: 'S/N', render: (_, row) => textHtml(row.sku) },
    { key: 'name', label: 'Name', render: (_, row) => textHtml(row.name) },
    { key: 'category', label: 'Type' },
    { key: 'brandName', label: 'Brand', render: (_, row) => textHtml(row.brandName) },
    {
      key: 'employeeName',
      label: 'Assigned to',
      render: (_, row) => employeeCodeHtml(row.employeeCode, row.employeeName),
    },
    {
      key: 'branchName',
      label: 'Branch',
      render: (_, row) => branchCodeHtml(row.branchCode, row.branchName),
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
    {
      key: 'actions',
      label: 'Actions',
      orderable: false,
      sortable: false,
      className: 'dt-right',
      render: (_, row) => catalogRowActionsHtml('/admin/items', row, {
        canManage,
        canDelete: canManage,
        deleteLabel: row.sku || row.name,
      }),
    },
  ], [canManage]);

  const ajaxParams = useMemo(() => ({ ...appliedFilters }), [appliedFilters]);
  const tableKey = useMemo(
    () => `products-${Object.values(appliedFilters).join('-')}-${canManage ? 'manage' : 'view'}`,
    [appliedFilters, canManage],
  );

  const filterOptions = useMemo(() => ({
    branches: buildBranchOptions(branches),
    brands: buildBrandOptions(brands),
  }), [branches, brands]);

  const tableActions = useMemo(() => buildTableActions({
    appliedFilters,
    statusActions: [
      { key: 'status-available', label: 'Mark available', status: 'available' },
      { key: 'status-discontinued', label: 'Mark discontinued', status: 'discontinued' },
    ],
  }), [appliedFilters, buildTableActions]);

  return (
    <div>
      <PageHeader
        title={pageTitle}
        subtitle="Product catalog with live stock levels"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Inventory', to: '/admin/items' },
          { label: pageTitle },
        ]}
        actions={canManage ? (
          <Link
            to="/admin/items/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Add product
          </Link>
        ) : null}
      />

      <DynamicListFilters
        fields={PRODUCT_FILTER_FIELDS}
        values={filters}
        onChange={setFilters}
        optionsMap={filterOptions}
        onApply={(next) => {
          setAppliedFilters(next);
          clearSelection();
        }}
        onClear={() => {
          const cleared = buildInitialFilters(PRODUCT_FILTER_FIELDS);
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
          ajaxUrl="/admin/items"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No products found"
          getRowHref={(row) => `/admin/items/${row.id}`}
          onRowDelete={canManage ? handleDeleteRequest : undefined}
          selectable={selectable}
          tableKey={tableKey}
        />
      </Card>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={deleteTarget?.mode === 'bulk' ? 'Delete selected products' : 'Delete product'}
        message={deleteTarget?.mode === 'bulk'
          ? `Delete ${deleteTarget.count} selected product(s)? This cannot be undone.`
          : `Delete ${deleteTarget?.label || 'this product'}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />

      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        onClose={() => !updatingStatus && setStatusTarget(null)}
        onConfirm={handleStatusConfirm}
        title="Change product status"
        message={`Update ${statusTarget?.count || 0} selected product(s) to ${statusTarget?.label || statusTarget?.status || ''}?`}
        confirmLabel="Update status"
        loading={updatingStatus}
      />
    </div>
  );
}
