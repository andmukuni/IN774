import { getApiBase } from './apiBase';
import { getAdminAuthHeaders } from './authHeaders';

const API_BASE = getApiBase();

export async function downloadAdminExport({
  path,
  params = {},
  fallbackFilename = 'export.csv',
  errorMessage = 'Export failed.',
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') searchParams.set(key, String(value));
  });

  const sep = path.includes('?') ? '&' : '?';
  const url = `${API_BASE}${path}${searchParams.size ? `${sep}${searchParams.toString()}` : ''}`;

  const res = await fetch(url, {
    headers: getAdminAuthHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.message || errorMessage);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
