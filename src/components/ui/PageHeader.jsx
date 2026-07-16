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
    setPageMeta({ breadcrumbs });
    return () => setPageMeta({ breadcrumbs: [] });
  }, [JSON.stringify(breadcrumbs), setPageMeta]);

  return (
    <div className="mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-navy-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
