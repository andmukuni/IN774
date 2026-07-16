import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BreadcrumbNav({ items = [], className = '' }) {
  if (!items.length) return null;

  return (
    <nav
      className={`flex items-center gap-1 text-xs sm:text-sm text-navy-400 overflow-x-auto whitespace-nowrap min-w-0 ${className}`}
      aria-label="Breadcrumb"
    >
      {items.map((crumb, idx) => (
        <span key={`${crumb.label}-${idx}`} className="flex items-center gap-1 shrink-0">
          {idx > 0 && <ChevronRight size={14} className="text-navy-300 shrink-0" />}
          {crumb.to ? (
            <Link
              to={crumb.to}
              className="hover:text-cyan-600 transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-navy-600 font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
