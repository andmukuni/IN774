import dns from 'dns/promises';
import net from 'net';
import { isIP } from 'net';

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80')) return true;
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.slice('::ffff:'.length);
    if (isIP(v4) === 4) return isPrivateIpv4(v4);
  }
  return false;
}

export function isBlockedOrPrivateIp(ip) {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

export function isMetadataIp(ip) {
  return ip === '169.254.169.254' || ip === 'fd00:ec2::254';
}

export async function assertSafeHost(hostname, { allowPrivateNetwork = false } = {}) {
  const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) {
    const err = new Error('Hostname is required.');
    err.code = 'SSRF_BLOCKED';
    throw err;
  }

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    if (!allowPrivateNetwork) {
      const err = new Error('Private/local hostnames are blocked unless allow private network is enabled.');
      err.code = 'SSRF_BLOCKED';
      throw err;
    }
  }

  let addresses = [];
  const ipVersion = isIP(host);
  if (ipVersion) {
    addresses = [host];
  } else {
    try {
      const results = await dns.lookup(host, { all: true, verbatim: true });
      addresses = results.map((r) => r.address);
    } catch {
      const err = new Error(`Unable to resolve host: ${host}`);
      err.code = 'DNS_FAILED';
      throw err;
    }
  }

  if (!addresses.length) {
    const err = new Error(`Unable to resolve host: ${host}`);
    err.code = 'DNS_FAILED';
    throw err;
  }

  for (const address of addresses) {
    if (isMetadataIp(address)) {
      const err = new Error('Cloud metadata addresses are not allowed.');
      err.code = 'SSRF_BLOCKED';
      throw err;
    }
    if (isBlockedOrPrivateIp(address) && !allowPrivateNetwork) {
      const err = new Error(
        'Resolved address is private/internal. Enable “Allow private network” to monitor LAN hosts.',
      );
      err.code = 'SSRF_BLOCKED';
      throw err;
    }
  }

  return { hostname: host, addresses };
}

export async function assertSafeUrl(rawUrl, { allowPrivateNetwork = false } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    const err = new Error('Invalid URL.');
    err.code = 'INVALID_URL';
    throw err;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    const err = new Error('Only http and https URLs are allowed.');
    err.code = 'SSRF_BLOCKED';
    throw err;
  }
  if (url.username || url.password) {
    const err = new Error('URLs with embedded credentials are not allowed.');
    err.code = 'SSRF_BLOCKED';
    throw err;
  }
  const resolved = await assertSafeHost(url.hostname, { allowPrivateNetwork });
  return { url, ...resolved };
}

export function isTcpPortValid(port) {
  const n = Number(port);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

export { net };
