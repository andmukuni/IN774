import {
  Package,
  Boxes,
  AlertTriangle,
  PackageX,
  Wallet,
  Tags,
  PlusCircle,
  Settings,
  Shield,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, AdminStatCard, Card, DataTable, Spinner } from '../../components/ui';
import InventoryWelcomeCard from '../../components/admin/InventoryWelcomeCard';
import MonitorDashboardKpis from '../../components/admin/MonitorDashboardKpis';
import { formatCurrency } from '../../utils/helpers';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';
import { productStatusHtml, skuHtml, qtyHtml, dateHtml, currencyHtml } from '../../utils/datatableHelpers';

const API_BASE = getApiBase();

function StatSection({ title, children, gridClassName = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3' }) {
  return (
    <section className="mb-6">
      {title && (
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-3">{title}</h2>
      )}
      <div className={gridClassName}>
        {children}
      </div>
    </section>
  );
}

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
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/dashboard/stats`, {
        headers: getAdminAuthHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Failed to load dashboard stats');
      }
      setStats(json.data);
    } catch (err) {
      setError(err?.message || 'Unable to load dashboard.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const stockCards = useMemo(() => {
    if (!stats) return [];

    return [
      {
        label: 'Total Products',
        value: stats.totalProducts,
        icon: Package,
        color: 'navy',
        subtitle: 'Active catalog items',
        to: '/admin/items',
      },
      {
        label: 'Units in Stock',
        value: stats.totalUnits,
        icon: Boxes,
        color: 'cyan',
        subtitle: 'Total quantity on hand',
      },
      {
        label: 'Low Stock',
        value: stats.lowStockCount,
        icon: AlertTriangle,
        color: 'amber',
        subtitle: 'Below reorder level',
        to: '/admin/items?status=low_stock',
      },
      {
        label: 'Out of Stock',
        value: stats.outOfStockCount,
        icon: PackageX,
        color: 'red',
        subtitle: 'Zero quantity items',
        to: '/admin/items?status=out_of_stock',
      },
      {
        label: 'Inventory Value',
        value: formatCurrency(stats.inventoryValue),
        icon: Wallet,
        color: 'purple',
        subtitle: 'Qty × price (K)',
      },
      {
        label: 'Categories',
        value: stats.categoryCount,
        icon: Tags,
        color: 'green',
        subtitle: 'Product groupings',
        to: '/admin/categories',
      },
    ];
  }, [stats]);

  let cardIndex = 0;
  const nextDelay = () => {
    const delay = cardIndex * 60;
    cardIndex += 1;
    return delay;
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Inventory overview and stock health"
        breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Dashboard' }]}
      />

      <InventoryWelcomeCard />

      <MonitorDashboardKpis />

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      )}

      {!loading && error && (
        <Card title="Dashboard error" className="mb-6">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!loading && stats && (
        <>
          <StatSection title="Stock overview">
            {stockCards.map((stat) => (
              <AdminStatCard key={stat.label} animationDelay={nextDelay()} {...stat} />
            ))}
          </StatSection>

          <Card title="Quick actions" className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                to="/admin/items/new"
                className="rounded-xl border border-navy-100 p-4 hover:border-cyan-300 hover:bg-cyan-50/50 transition-colors"
              >
                <p className="font-medium text-navy-900 flex items-center gap-2">
                  <PlusCircle size={16} className="text-cyan-600" />
                  Add product
                </p>
                <p className="text-xs text-navy-500 mt-1">Create a new inventory item</p>
              </Link>
              <Link
                to="/admin/items"
                className="rounded-xl border border-navy-100 p-4 hover:border-cyan-300 hover:bg-cyan-50/50 transition-colors"
              >
                <p className="font-medium text-navy-900">View products</p>
                <p className="text-xs text-navy-500 mt-1">Browse full product catalog</p>
              </Link>
              <Link
                to="/admin/settings"
                className="rounded-xl border border-navy-100 p-4 hover:border-cyan-300 hover:bg-cyan-50/50 transition-colors"
              >
                <p className="font-medium text-navy-900 flex items-center gap-2">
                  <Settings size={16} className="text-navy-400" />
                  System settings
                </p>
                <p className="text-xs text-navy-500 mt-1">App configuration</p>
              </Link>
              <Link
                to="/admin/access-control"
                className="rounded-xl border border-navy-100 p-4 hover:border-cyan-300 hover:bg-cyan-50/50 transition-colors"
              >
                <p className="font-medium text-navy-900 flex items-center gap-2">
                  <Shield size={16} className="text-navy-400" />
                  Access control
                </p>
                <p className="text-xs text-navy-500 mt-1">Roles and permissions</p>
              </Link>
            </div>
          </Card>

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
        </>
      )}
    </div>
  );
}
