import { useEffect, useState } from 'react';
import { getApiBase } from '../utils/apiBase';
import { getAdminAuthHeaders } from '../utils/authHeaders';

const API_BASE = getApiBase();

export function useFetchRecord(endpoint, id) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const recordId = String(id || '').trim();

    if (!recordId) {
      setLoading(false);
      setError('Record not found.');
      setRecord(null);
      return undefined;
    }

    setLoading(true);
    setError('');
    setRecord(null);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}${endpoint}/${encodeURIComponent(recordId)}`, {
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || 'Failed to load record');
        }
        setRecord(json.data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load record.');
          setRecord(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [endpoint, id]);

  return { record, loading, error };
}
