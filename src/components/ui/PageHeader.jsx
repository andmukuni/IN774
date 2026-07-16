import { useEffect } from 'react';
import { useAdminPage } from '../../context/AdminPageContext';

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
}) {
  const { setPageMeta } = useAdminPage();

  useEffect(() => {
    setPageMeta({ breadcrumbs, actions });
    return () => setPageMeta({ breadcrumbs: [], actions: null });
  }, [JSON.stringify(breadcrumbs), actions, setPageMeta]);

  return (
    <div className="mb-4">
      <div>
        <h1 className="text-xl font-bold text-navy-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-navy-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="mt-3 flex flex-wrap items-center gap-2 md:hidden">
          {actions}
        </div>
      )}
    </div>
  );
}
