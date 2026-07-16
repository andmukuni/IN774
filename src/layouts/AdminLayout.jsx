import { useEffect, useState, Suspense } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  Settings,
  Menu,
  X,
  Shield,
  Package,
  Tags,
  AlertTriangle,
  Building2,
  UserRound,
  BadgeCheck,
  ExternalLink,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import AdminUserMenu from '../components/admin/AdminUserMenu';
import BreadcrumbNav from '../components/ui/BreadcrumbNav';
import { AdminPageProvider, useAdminPage } from '../context/AdminPageContext';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { NAV_PERMISSION_MAP } from '../../shared/rbacPermissions.js';
import { getApiBase } from '../utils/apiBase';
import { getAdminAuthHeaders } from '../utils/authHeaders';

const API_BASE = getApiBase();

const INVENTORY_NAVIGATION = [
  { key: 'items', name: 'Products', to: '/admin/items', icon: Package, badgeKey: null },
  { key: 'branches', name: 'Branches', to: '/admin/branches', icon: Building2 },
  { key: 'employees', name: 'Employees', to: '/admin/employees', icon: UserRound },
  { key: 'items-low-stock', name: 'Low Stock', to: '/admin/items?status=low_stock', icon: AlertTriangle, badgeKey: 'lowStock' },
  { key: 'brands', name: 'Brands', to: '/admin/brands', icon: BadgeCheck },
  { key: 'categories', name: 'Product Types', to: '/admin/categories', icon: Tags },
  { key: 'intake', name: 'Branch report', to: '/intake', icon: ExternalLink, external: true },
];

const SYSTEM_NAVIGATION = [
  { key: 'users', name: 'Users', to: '/admin/users', icon: Users },
  { key: 'access-control', name: 'Access Control', to: '/admin/access-control', icon: Shield },
];

const NAV_GROUPS = [
  { key: 'inventory', label: 'Inventory', icon: Package, items: INVENTORY_NAVIGATION },
  { key: 'system', label: 'System', icon: Shield, items: SYSTEM_NAVIGATION },
];

function navItemAllowed(navKey, hasPermission) {
  if (!navKey) return true;
  const perm = NAV_PERMISSION_MAP[navKey];
  if (!perm) return true;
  return hasPermission(perm);
}

function AdminOutletLoader() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-100 border-t-cyan-600" />
        <p className="text-sm text-navy-500">Loading page…</p>
      </div>
    </div>
  );
}

function isPathInGroup(pathname, items = []) {
  return items.some((item) => {
    if (item.end) return pathname === item.to;
    const base = item.to.split('?')[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}

function SidebarNavGroup({
  label,
  icon: GroupIcon,
  items,
  onNavigate,
  pathname,
  productCounts = {},
}) {
  if (!items.length) return null;

  const groupActive = isPathInGroup(pathname, items);

  return (
    <div className="pt-1">
      <div
        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold ${
          groupActive ? 'text-cyan-400' : 'text-navy-300'
        }`}
      >
        {GroupIcon && <GroupIcon size={15} className="shrink-0" />}
        <span className="truncate">{label}</span>
      </div>

      <div className="ml-3 mt-1 space-y-0.5 border-l border-navy-800 pl-2">
        {items.map((item) => (
          <SidebarNavLink
            key={item.key}
            item={item}
            onNavigate={onNavigate}
            badge={item.badgeKey ? productCounts[item.badgeKey] : 0}
            nested
          />
        ))}
      </div>
    </div>
  );
}

function SidebarNavLink({ item, onNavigate, badge, nested = false, prominent = false, fill = false }) {
  const classFor = (isActive) =>
    `flex items-center justify-between gap-2 font-medium transition-colors ${
      prominent ? 'text-base' : 'text-sm'
    } ${
      fill
        ? 'w-full px-4 py-3 rounded-none'
        : nested
          ? 'rounded-lg px-2 py-1.5'
          : 'rounded-lg px-2.5 py-2'
    } ${
      isActive
        ? 'bg-cyan-600/10 text-cyan-400'
        : 'text-navy-300 hover:bg-navy-800 hover:text-white'
    }`;

  if (item.external) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onNavigate?.()}
        className={classFor(false)}
      >
        <span className="flex items-center gap-2 min-w-0">
          <item.icon size={prominent ? 16 : 14} className="shrink-0" />
          <span className="truncate">{item.name}</span>
        </span>
      </a>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={() => onNavigate?.()}
      className={({ isActive }) => classFor(isActive)}
    >
      <span className="flex items-center gap-2 min-w-0">
        <item.icon size={prominent ? 16 : 14} className="shrink-0" />
        <span className="truncate">{item.name}</span>
      </span>
      {badge > 0 && (
        <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-600 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

function AdminTopBar({ user, onOpenSidebar }) {
  const { breadcrumbs, actions } = useAdminPage();

  return (
    <header className="fixed top-0 right-0 left-0 md:left-72 z-30 h-14 bg-white border-b border-navy-100 flex items-center gap-2 px-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="md:hidden p-2 rounded-lg text-navy-500 hover:bg-navy-100 hover:text-navy-700 transition-colors shrink-0"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        {breadcrumbs.length > 0 ? (
          <BreadcrumbNav items={breadcrumbs} />
        ) : (
          <p className="text-sm text-navy-400 truncate">
            Welcome back,{' '}
            <span className="font-medium text-navy-700">{user?.name?.split(' ')[0] || 'Admin'}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {actions && (
          <div className="hidden md:flex items-center gap-2">
            {actions}
          </div>
        )}
        <a
          href="/intake"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-cyan-800 hover:bg-cyan-100 transition-colors"
          title="Open public branch equipment form"
        >
          <ExternalLink size={14} />
          <span className="hidden sm:inline">Branch report</span>
        </a>
        <ThemeToggle variant="admin" />
        <AdminUserMenu />
      </div>
    </header>
  );
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productCounts, setProductCounts] = useState({});
  const { user, hasPermission } = useAuth();
  const { companyName } = useCompany();
  const location = useLocation();

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => navItemAllowed(item.key, hasPermission)),
  })).filter((group) => group.items.length > 0);

  const canManageSettings = navItemAllowed('settings', hasPermission);
  const showDashboard = navItemAllowed('dashboard', hasPermission);
  const showAddProduct = navItemAllowed('items-create', hasPermission);

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (!sidebarOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!hasPermission('items.view')) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/products/counts`, {
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        });
        const json = await res.json();
        if (!cancelled && json?.ok) setProductCounts(json.data || {});
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [hasPermission, location.pathname]);

  return (
    <AdminPageProvider>
      <div className="min-h-screen bg-navy-50">
        <aside
          className={`theme-fixed fixed inset-y-0 left-0 z-50 w-72 bg-navy-950 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="relative flex items-center justify-center px-4 h-14 border-b border-navy-800">
            <Link to="/admin" className="flex items-center justify-center" aria-label={`${companyName} Admin`}>
              <span className="text-white font-black text-2xl uppercase tracking-wide">{companyName}</span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden absolute right-3 p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-navy-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto">
            {showDashboard && (
              <div className="border-b border-navy-800">
                <SidebarNavLink
                  item={{ key: 'dashboard', name: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true }}
                  onNavigate={closeSidebar}
                  prominent
                  fill
                />
              </div>
            )}

            <div className={`px-4 pb-4 space-y-1 ${showDashboard ? 'pt-3' : 'pt-4'}`}>
              {showAddProduct && (
                <NavLink
                  to="/admin/items/new"
                  end
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-cyan-500 text-white'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    } mb-4`
                  }
                >
                  <PlusCircle size={16} />
                  Add Product
                </NavLink>
              )}

              {navGroups.map((group, index) => (
                <div key={group.key} className={index === 0 ? (showAddProduct ? '' : 'pt-2') : 'pt-2'}>
                  <SidebarNavGroup
                    label={group.label}
                    icon={group.icon}
                    items={group.items}
                    onNavigate={closeSidebar}
                    pathname={location.pathname}
                    productCounts={productCounts}
                  />
                </div>
              ))}
            </div>
          </nav>

          {canManageSettings && (
            <div className="shrink-0 border-t border-navy-800 p-4">
              <NavLink
                to="/admin/settings"
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-600/10 text-cyan-400'
                      : 'text-navy-300 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                <Settings size={14} />
                Settings
              </NavLink>
            </div>
          )}
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <AdminTopBar user={user} onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="md:ml-72 mt-14 min-h-[calc(100vh-3.5rem)] overflow-x-clip">
          <div className="p-2.5 sm:p-4 lg:px-5">
            <Suspense fallback={<AdminOutletLoader />}>
              <Outlet key={location.pathname} />
            </Suspense>
          </div>
        </main>
      </div>
    </AdminPageProvider>
  );
}
