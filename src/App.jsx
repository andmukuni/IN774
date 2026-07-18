import { Suspense, lazy, Component } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { Modal } from './components/ui';
import TopProgressBar from './components/ui/TopProgressBar';
import { useAuth } from './context/AuthContext';
import { purgeInvalidAuthState } from './utils/authHeaders';

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const LoginPage = lazy(() => import('./pages/admin/LoginPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const DemoItemsListPage = lazy(() => import('./pages/admin/DemoItemsListPage'));
const DemoItemFormPage = lazy(() => import('./pages/admin/DemoItemFormPage'));
const DemoUsersPage = lazy(() => import('./pages/admin/DemoUsersPage'));
const SystemSettingsPage = lazy(() => import('./pages/admin/SystemSettingsPage'));
const DemoAccessControlPage = lazy(() => import('./pages/admin/DemoAccessControlPage'));
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'));
const CategoryFormPage = lazy(() => import('./pages/admin/CategoryFormPage'));
const CategoryShowPage = lazy(() => import('./pages/admin/CategoryShowPage'));
const BrandsListPage = lazy(() => import('./pages/admin/BrandsListPage'));
const BrandFormPage = lazy(() => import('./pages/admin/BrandFormPage'));
const BrandShowPage = lazy(() => import('./pages/admin/BrandShowPage'));
const BranchesListPage = lazy(() => import('./pages/admin/BranchesListPage'));
const BranchFormPage = lazy(() => import('./pages/admin/BranchFormPage'));
const EmployeesListPage = lazy(() => import('./pages/admin/EmployeesListPage'));
const EmployeeFormPage = lazy(() => import('./pages/admin/EmployeeFormPage'));
const ItemShowPage = lazy(() => import('./pages/admin/ItemShowPage'));
const BranchShowPage = lazy(() => import('./pages/admin/BranchShowPage'));
const EmployeeShowPage = lazy(() => import('./pages/admin/EmployeeShowPage'));
const UserShowPage = lazy(() => import('./pages/admin/UserShowPage'));
const UserFormPage = lazy(() => import('./pages/admin/UserFormPage'));
const PublicLayout = lazy(() => import('./layouts/PublicLayout'));
const DeveloperPage = lazy(() => import('./pages/admin/DeveloperPage'));

function RouteLoader() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-navy-100 border-t-navy-900 animate-spin" />
      <p className="text-navy-500 text-sm animate-pulse">Loading page...</p>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-bold text-navy-900">Something went wrong</h2>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    idleLogoutPromptOpen,
    dismissIdleLogoutPrompt,
    adminIdleTimeoutMinutes,
  } = useAuth();

  const openAdminLogin = () => {
    dismissIdleLogoutPrompt();
    purgeInvalidAuthState();
    navigate('/admin/login', { state: { from: { pathname: location.pathname } } });
  };

  return (
    <>
      <TopProgressBar />
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin/login" replace />} />

            <Route path="/admin/login" element={<LoginPage />} />

            <Route path="/intake" element={<PublicLayout />}>
              <Route index element={<BranchIntakePage />} />
              <Route path=":branchCode" element={<BranchIntakePage />} />
            </Route>

            <Route
              path="/admin"
              element={(
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              )}
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="items" element={<DemoItemsListPage />} />
              <Route path="items/new" element={<DemoItemFormPage />} />
              <Route path="items/:id/edit" element={<DemoItemFormPage />} />
              <Route path="items/:id" element={<ItemShowPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="categories/new" element={<CategoryFormPage />} />
              <Route path="categories/:id/edit" element={<CategoryFormPage />} />
              <Route path="categories/:id" element={<CategoryShowPage />} />
              <Route path="brands" element={<BrandsListPage />} />
              <Route path="brands/new" element={<BrandFormPage />} />
              <Route path="brands/:id/edit" element={<BrandFormPage />} />
              <Route path="brands/:id" element={<BrandShowPage />} />
              <Route path="branches" element={<BranchesListPage />} />
              <Route path="branches/new" element={<BranchFormPage />} />
              <Route path="branches/:id/edit" element={<BranchFormPage />} />
              <Route path="branches/:id" element={<BranchShowPage />} />
              <Route path="employees" element={<EmployeesListPage />} />
              <Route path="employees/new" element={<EmployeeFormPage />} />
              <Route path="employees/:id/edit" element={<EmployeeFormPage />} />
              <Route path="employees/:id" element={<EmployeeShowPage />} />
              <Route path="users" element={<DemoUsersPage />} />
              <Route path="users/new" element={<UserFormPage />} />
              <Route path="users/:id/edit" element={<UserFormPage />} />
              <Route path="users/:id" element={<UserShowPage />} />
              <Route path="settings" element={<SystemSettingsPage />} />
              <Route path="developer" element={<DeveloperPage />} />
              <Route path="access-control" element={<DemoAccessControlPage />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>

      <Modal
        isOpen={idleLogoutPromptOpen}
        onClose={dismissIdleLogoutPrompt}
        title="Session ended"
        size="sm"
      >
        <p className="text-sm text-navy-600 mb-4">
          Your admin session ended after {adminIdleTimeoutMinutes} minutes of inactivity.
        </p>
        <button
          type="button"
          onClick={openAdminLogin}
          className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
        >
          Sign in again
        </button>
      </Modal>
    </>
  );
}
