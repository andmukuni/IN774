const _genericRateBuckets = new Map();

export function rateLimitByKey({ windowMs = 60_000, max = 10, routeKey, getKey }) {
  return (req, res, next) => {
    const key = `${routeKey}::${getKey(req)}`;
    const now = Date.now();

    let bucket = _genericRateBuckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      _genericRateBuckets.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({
        ok: false,
        message: 'Too many requests. Please try again shortly.',
      });
    }

    return next();
  };
}

export function evaluateCorsOrigin(origin, { corsOrigins, serverOrigin, nodeEnv }) {
  if (!origin) return { allowed: true };
  if (serverOrigin && origin === serverOrigin) return { allowed: true };
  if (corsOrigins.length > 0) {
    return corsOrigins.includes(origin)
      ? { allowed: true }
      : { allowed: false, reason: 'origin_not_listed' };
  }
  if (nodeEnv === 'production') {
    return { allowed: false, reason: 'cors_origins_unset' };
  }
  return { allowed: true };
}
