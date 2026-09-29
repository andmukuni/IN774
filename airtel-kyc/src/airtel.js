import { getConfig } from './config.js';
import { interpretEnquiry } from './interpret.js';
import { formatForAirtel, parseZambiaMsisdn } from './msisdn.js';

const defaultTokenCache = {
  accessToken: null,
  expiresAt: 0,
};

export class KycError extends Error {
  constructor(message, code, status = 500) {
    super(message);
    this.name = 'KycError';
    this.code = code;
    this.status = status;
  }
}

export function clearTokenCache() {
  defaultTokenCache.accessToken = null;
  defaultTokenCache.expiresAt = 0;
}

function endpoint(baseUrl, path, suffix = '') {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const relative = `${path.replace(/^\/+/, '')}${suffix}`;
  return new URL(relative, root);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tokenTtlMs(expiresIn) {
  const seconds = Number(expiresIn);
  const ttl = Number.isFinite(seconds) && seconds > 0 ? seconds : 180;
  const skew = Math.min(30, Math.floor(ttl / 2));
  return (ttl - skew) * 1000;
}

async function requestToken(config, fetchImpl) {
  const response = await fetchImpl(endpoint(config.baseUrl, config.tokenPath), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: config.grantType,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const body = await readJson(response);
  const accessToken = body?.access_token;
  if (!response.ok || !accessToken) {
    const message = body?.error_description || body?.message || body?.status?.message;
    throw new KycError(
      message || 'Airtel did not issue an access token.',
      'AUTH_FAILED',
      response.status === 401 || response.status === 403 ? 401 : 502,
    );
  }
  return {
    accessToken,
    expiresIn: Number(body.expires_in) || 180,
    expiresAt: Date.now() + tokenTtlMs(body.expires_in),
  };
}

async function getAccessToken(config, fetchImpl, cache, forceRefresh) {
  if (!forceRefresh && cache.accessToken && cache.expiresAt > Date.now()) {
    return cache.accessToken;
  }
  const token = await requestToken(config, fetchImpl);
  cache.accessToken = token.accessToken;
  cache.expiresAt = token.expiresAt;
  return token.accessToken;
}

function mockBody(parsed) {
  const last4 = parsed.national.slice(-4);
  if (last4 === '0000') {
    return {
      status: {
        code: '404',
        message: 'User not found.',
        result_code: 'ROUTER404',
        success: false,
      },
    };
  }
  const unregistered = last4 === '2222';
  return {
    data: {
      first_name: 'Mutale',
      last_name: 'Phiri',
      grade: unregistered ? 'UNSUB' : 'GOLD',
      is_barred: last4 === '1111',
      is_pin_set: !unregistered,
      msisdn: parsed.national,
      registration: { status: unregistered ? 'UNREGISTERED' : 'SUBS' },
    },
    status: {
      code: '200',
      message: 'SUCCESS',
      result_code: 'ESB000010',
      success: true,
    },
  };
}

function withInput(result, parsed, queriedMsisdn) {
  return {
    ...result,
    queriedMsisdn,
    input: {
      national: parsed.national,
      local: parsed.local,
      international: parsed.international,
      e164: parsed.e164,
      isAirtelPrefix: parsed.isAirtelPrefix,
      prefixWarning: parsed.prefixWarning,
    },
  };
}

export async function testConnection(options = {}) {
  const config = options.config ?? getConfig();
  if (config.mock) return { ok: true, mock: true };
  if (!config.clientId || !config.clientSecret) {
    throw new KycError('Airtel client id and client secret are not configured.', 'NOT_CONFIGURED', 503);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = options.tokenCache ?? defaultTokenCache;
  const token = await requestToken(config, fetchImpl);
  cache.accessToken = token.accessToken;
  cache.expiresAt = token.expiresAt;
  return { ok: true, mock: false, expiresIn: token.expiresIn };
}

export async function enquireUser(msisdn, options = {}) {
  const config = options.config ?? getConfig();
  const parsed = parseZambiaMsisdn(msisdn);
  if (!parsed.ok) throw new KycError(parsed.error, 'INVALID_MSISDN', 400);

  const queriedMsisdn = formatForAirtel(parsed, config.msisdnFormat);
  if (config.mock) {
    const interpreted = interpretEnquiry(mockBody(parsed), 200);
    return withInput(interpreted, parsed, queriedMsisdn);
  }

  if (!config.clientId || !config.clientSecret) {
    throw new KycError('Airtel client id and client secret are not configured.', 'NOT_CONFIGURED', 503);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = options.tokenCache ?? defaultTokenCache;

  async function call(forceRefresh) {
    const token = await getAccessToken(config, fetchImpl, cache, forceRefresh);
    return fetchImpl(endpoint(config.baseUrl, config.userPath, `/${encodeURIComponent(queriedMsisdn)}`), {
      method: 'GET',
      headers: {
        Accept: config.accept,
        'X-Country': config.country,
        'X-Currency': config.currency,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  }

  let response = await call(false);
  if (response.status === 401) {
    response = await call(true);
  }
  const body = await readJson(response);
  return withInput(interpretEnquiry(body, response.status), parsed, queriedMsisdn);
}
