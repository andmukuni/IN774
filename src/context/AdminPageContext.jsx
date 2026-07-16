import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AdminPageContext = createContext(null);

export function AdminPageProvider({ children }) {
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [actions, setActions] = useState(null);

  const setPageMeta = useCallback(({ breadcrumbs: next = [], actions: nextActions = null } = {}) => {
    setBreadcrumbs(Array.isArray(next) ? next : []);
    setActions(nextActions ?? null);
  }, []);

  const value = useMemo(
    () => ({ breadcrumbs, actions, setPageMeta }),
    [actions, breadcrumbs, setPageMeta],
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
