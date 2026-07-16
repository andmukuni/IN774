import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { COMPANY_BRANDING_CACHE_KEY, DEFAULT_COMPANY_NAME } from '../constants/company';
import { getApiBase } from '../utils/apiBase';

const API_BASE = getApiBase();

const CompanyContext = createContext(null);

function readCachedCompany() {
  try {
    const raw = localStorage.getItem(COMPANY_BRANDING_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedCompany(data) {
  try {
    localStorage.setItem(COMPANY_BRANDING_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

function applyDocumentTitle(name) {
  const trimmed = String(name || '').trim();
  if (trimmed) {
    document.title = trimmed;
  }
}

export function CompanyProvider({ children }) {
  const [company, setCompanyState] = useState(() => readCachedCompany() || { name: DEFAULT_COMPANY_NAME });
  const [loading, setLoading] = useState(true);

  const applyCompany = useCallback((data) => {
    const next = data && typeof data === 'object' ? data : {};
    setCompanyState(next);
    writeCachedCompany(next);
    applyDocumentTitle(next.name);
  }, []);

  useEffect(() => {
    applyDocumentTitle(company.name || DEFAULT_COMPANY_NAME);
  }, [company.name]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/settings`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json?.ok && json.data?.companyName) {
          applyCompany({ name: json.data.companyName });
        }
      } catch {
        // keep cached/default branding
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applyCompany]);

  const companyName = useMemo(
    () => String(company.name || '').trim() || DEFAULT_COMPANY_NAME,
    [company.name],
  );

  const value = useMemo(
    () => ({
      company,
      companyName,
      loading,
      setCompany: applyCompany,
    }),
    [company, companyName, loading, applyCompany],
  );

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return ctx;
}
