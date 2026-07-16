import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { PageHeader, DataTable, Card, ListSearchFilters, emptySearchFilters } from '../../components/ui';
import { branchStatusHtml, dateHtml, textHtml } from '../../utils/datatableHelpers';

export default function CategoriesPage() {
  const tableRef = useRef(null);
  const [filters, setFilters] = useState(emptySearchFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptySearchFilters);

  const reloadTable = useCallback(() => {
    tableRef.current?.reload(false);
  }, []);

  const columns = [
    { key: 'code', label: 'Code', render: (_, row) => textHtml(row.code) },
    { key: 'name', label: 'Type', render: (_, row) => textHtml(row.name) },
    { key: 'description', label: 'Description', render: (_, row) => textHtml(row.description) },
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
  ];

  const ajaxParams = useMemo(() => ({
    search: appliedFilters.search,
  }), [appliedFilters.search]);

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
        actions={(
          <Link
            to="/admin/categories/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Add product type
          </Link>
        )}
      />

      <p className="mb-4 text-sm text-navy-600 max-w-3xl">
        <span className="font-medium text-navy-800">Product type</span> describes what the asset is
        (Monitor, TV, Desktop). <span className="font-medium text-navy-800">Brand</span> is who made it
        (HP, Dell) — see the <Link to="/admin/brands" className="text-cyan-700 hover:underline">Brands</Link> page.
      </p>

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
        placeholder="Search type code, name, or description..."
      />

      <Card noPadding>
        <DataTable
          ref={tableRef}
          columns={columns}
          serverSide
          ajaxUrl="/admin/product-types"
          ajaxParams={ajaxParams}
          pageLength={25}
          emptyTitle="No product types found"
          getRowHref={(row) => `/admin/categories/${row.id}`}
          tableKey={`product-types-${appliedFilters.search}`}
        />
      </Card>
    </div>
  );
}
