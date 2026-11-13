import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { getApiBase } from '../utils/apiBase';
import { getAdminAuthHeaders } from '../utils/authHeaders';

const API_BASE = getApiBase();

export function useDeleteRecord(endpoint, { redirectTo, successMessage = 'Record deleted.' } = {}) {
  const navigate = useNavigate();
  const toast = useToast();

  return useCallback(async (id) => {
    const recordId = String(id || '').trim();
    if (!recordId) return;

    const res = await fetch(`${API_BASE}${endpoint}/${encodeURIComponent(recordId)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      toast.error(json?.message || 'Failed to delete record.');
      throw new Error(json?.message || 'Failed to delete record.');
    }

    toast.success(successMessage);
    if (redirectTo) navigate(redirectTo);
  }, [endpoint, navigate, redirectTo, successMessage, toast]);
}
