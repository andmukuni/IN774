function readJsonStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isBearerTokenExpired(token, { skewSeconds = 30 } = {}) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= Number(payload.exp) - Math.max(0, Number(skewSeconds) || 0);
}

export function clearAdminAuthStorage() {
  localStorage.removeItem('mm_auth_session');
  localStorage.removeItem('mm_admin_token');
}

export function clearAllAuthStorage() {
  clearAdminAuthStorage();
}

export function purgeInvalidAuthState() {
  const adminToken = localStorage.getItem('mm_admin_token') || '';
  const adminSession = readJsonStorage('mm_auth_session');

  if (adminToken && isBearerTokenExpired(adminToken)) {
    clearAdminAuthStorage();
  } else if (adminSession?.expiresAt && Date.now() > Number(adminSession.expiresAt)) {
    clearAdminAuthStorage();
  }
}

export function getAdminAuthHeaders(extra = {}) {
  purgeInvalidAuthState();
  const token = localStorage.getItem('mm_admin_token') || '';
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function buildPublicUserSession(userData, { expiresInMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
  if (!userData?.id) return null;
  return {
    ...userData,
    loggedInAt: Date.now(),
    expiresAt: Date.now() + expiresInMs,
  };
}

export const USER_SESSION_SYNC_EVENT = 'mm-user-session-sync';

export function dispatchUserSessionSync(session) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(USER_SESSION_SYNC_EVENT, { detail: session ?? null }));
}
