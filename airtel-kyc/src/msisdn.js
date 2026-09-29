const AIRTEL_PREFIXES = new Set(['97', '77', '57']);

export function parseZambiaMsisdn(input) {
  const raw = String(input ?? '').trim();
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('260')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);

  if (!/^[579]\d{8}$/.test(digits)) {
    return {
      ok: false,
      error: 'Enter a Zambian mobile number, for example 0971234567.',
    };
  }

  const prefix = digits.slice(0, 2);
  const isAirtelPrefix = AIRTEL_PREFIXES.has(prefix);
  return {
    ok: true,
    national: digits,
    local: `0${digits}`,
    international: `260${digits}`,
    e164: `+260${digits}`,
    prefix,
    isAirtelPrefix,
    prefixWarning: isAirtelPrefix
      ? null
      : 'This prefix is outside the usual Airtel Zambia ranges (057, 077, 097). The lookup is still sent.',
  };
}

export function formatForAirtel(parsed, format) {
  if (format === 'international') return parsed.international;
  if (format === 'local') return parsed.local;
  return parsed.national;
}
