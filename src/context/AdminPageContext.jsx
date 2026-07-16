import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AdminPageContext = createContext(null);

export function AdminPageProvider({ children }) {
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  const setPageMeta = useCallback(({ breadcrumbs: next = [] } = {}) => {
    setBreadcrumbs(Array.isArray(next) ? next : []);
  }, []);

  const value = useMemo(
    () => ({ breadcrumbs, setPageMeta }),
    [breadcrumbs, setPageMeta],
  );

  return (
    <AdminPageContext.Provider value={value}>
      {children}
    </AdminPageContext.Provider>
  );
}

export function useAdminPage() {
  const ctx = useContext(AdminPageContext);
  if (!ctx) {
    throw new Error('useAdminPage must be used within AdminPageProvider');
  }
  return ctx;
}
