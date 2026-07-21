import { PageHeader, Card, DataTable } from '../../components/ui';
import InventoryWelcomeCard from '../../components/admin/InventoryWelcomeCard';
import MonitorDashboardKpis from '../../components/admin/MonitorDashboardKpis';
import MonitorDashboardTargets from '../../components/admin/MonitorDashboardTargets';
import { productStatusHtml, skuHtml, qtyHtml, dateHtml, currencyHtml } from '../../utils/datatableHelpers';

const recentColumns = [
  {
    key: 'sku',
    label: 'S/N',
    render: (_, row) => skuHtml(row.sku, row.name),
  },
  { key: 'category', label: 'Category' },
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

export default function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Inventory overview and stock health"
        breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Dashboard' }]}
      />

      <InventoryWelcomeCard />

      <MonitorDashboardKpis />

      <MonitorDashboardTargets />

      <Card title="Recent products" subtitle="Latest updated items" noPadding>
        <DataTable
          columns={recentColumns}
          data={[]}
          serverSide
          ajaxUrl="/admin/items"
          ajaxParams={{ length: 5 }}
          pageLength={5}
          lengthMenu={[5]}
          emptyTitle="No products found"
          getRowHref={(row) => `/admin/items/${row.id}`}
          tableKey="dashboard-recent"
        />
      </Card>
    </div>
  );
}
