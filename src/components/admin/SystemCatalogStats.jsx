import {
  AlertTriangle,
  Boxes,
  Building2,
  Package,
  Tags,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminStatCard from '../ui/AdminStatCard';

export default function SystemCatalogStats({ counts, inventory }) {
  const entityCards = [
    { label: 'Branches', value: counts?.branches ?? 0, icon: Building2, to: '/admin/branches', color: 'cyan' },
    { label: 'Employees', value: counts?.employees ?? 0, icon: UserRound, to: '/admin/employees', color: 'blue' },
    { label: 'Products', value: counts?.products ?? 0, icon: Package, to: '/admin/items', color: 'navy' },
    { label: 'Brands', value: counts?.brands ?? 0, icon: Tags, to: '/admin/brands', color: 'purple' },
    { label: 'Product types', value: counts?.productTypes ?? 0, icon: Tags, to: '/admin/categories', color: 'gray' },
    { label: 'Users', value: counts?.users ?? 0, icon: Users, to: '/admin/users', color: 'green' },
  ];

  const stockCards = [
    { label: 'Total products', value: inventory?.totalProducts ?? 0, icon: Package, color: 'navy' },
    { label: 'Units in stock', value: inventory?.totalUnits ?? 0, icon: Boxes, color: 'cyan' },
    { label: 'Low stock', value: inventory?.lowStockCount ?? 0, icon: AlertTriangle, to: '/admin/items?status=low_stock', color: 'amber' },
    { label: 'Inventory value', value: inventory?.inventoryValue != null ? `K ${Number(inventory.inventoryValue).toLocaleString()}` : '—', icon: Wallet, color: 'green' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-400">Inventory snapshot</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stockCards.map((card) => (
            <AdminStatCard key={card.label} {...card} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-400">Catalog entities</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {entityCards.map((card) => (
            <AdminStatCard key={card.label} {...card} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/admin/items/new" className="font-medium text-cyan-700 hover:text-cyan-800">
          Add product
        </Link>
        <Link to="/admin/branches/new" className="font-medium text-cyan-700 hover:text-cyan-800">
          Add branch
        </Link>
        <Link to="/intake" target="_blank" rel="noreferrer" className="font-medium text-cyan-700 hover:text-cyan-800">
          Open branch intake
        </Link>
      </div>
    </div>
  );
}
